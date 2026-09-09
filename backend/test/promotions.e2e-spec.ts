import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { eq } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { resetDb } from "./support/reset-db"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import { PromotionsService } from "../src/modules/pricing/promotions.service"
import {
  bookings,
  notificationOutbox,
  partnerMembers,
  partnerOrgs,
  paymentEvents,
  payments,
  promotionProperties,
  promotionRooms,
  promotions,
  properties,
  ratePlans,
  rooms,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"

const iso = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

describe("promotions and loyalty tier", () => {
  let app: NestExpressApplication
  let db: Database
  let promotionsService: PromotionsService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false })
    app.setGlobalPrefix("api")
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" })
    app.set("trust proxy", 1)
    app.use(cookieParser(env.SESSION_SECRET))
    applyBodyParsers(app)
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()
    /*
     * Listen ONCE, here.
     *
     * Given a server that is not listening, supertest binds an ephemeral port
     * per request and closes it after. Under the concurrent tests — five
     * simultaneous bookings on one room — that listen/close churn produces an
     * occasional ECONNRESET, which reads as a failure of the thing being
     * tested rather than of the harness testing it. A flaky test on the
     * overbooking guarantee is worse than no test: it teaches people to re-run.
     */
    await app.listen(0)
    db = moduleRef.get<Database>(DRIZZLE)
    promotionsService = moduleRef.get(PromotionsService)
  })

  afterAll(async () => {
    await cleanup()
    await app?.close()
  })

  const cleanup = () => resetDb(db)

  const server = () => app.getHttpServer()
  let n = 0
  const freshIp = () => `198.51.100.${++n % 250}`

  type Fixture = Awaited<ReturnType<typeof seed>>
  let fx: Fixture

  async function seed() {
    const mkOrg = async (name: string, slug: string) => {
      const [org] = await db
        .insert(partnerOrgs)
        .values({ name, status: "active", commissionRateBps: 1500 })
        .returning()
      const [property] = await db
        .insert(properties)
        .values({
          slug,
          name,
          city: "New York",
          country: "USA",
          timezone: "America/New_York",
          checkInTime: "15:00",
          status: "active",
          basePrice: 72_500,
          partnerOrgId: org!.id,
        })
        .returning()
      const [room] = await db
        .insert(rooms)
        .values({
          propertyId: property!.id,
          name: "Deluxe King Room",
          maxAdults: 2,
          maxChildren: 1,
          maxOccupancy: 2,
          units: 5,
        })
        .returning()
      const [plan] = await db
        .insert(ratePlans)
        .values({
          roomId: room!.id,
          name: "Flexible",
          basePrice: 72_500,
          cancelFreeUntil: "48h",
          cancelCharge: "percent",
          cancelChargeValue: 50,
          isDefault: true,
        })
        .returning()
      return { org: org!, property: property!, room: room!, plan: plan! }
    }

    return {
      aurora: await mkOrg("Aurora", "the-ritz-carlton"),
      rival: await mkOrg("Rival", "rival-hotel"),
    }
  }

  async function guest(email = `g${n}@example.com`) {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "Amelia", lastName: "Hart" })
      .expect(201)

    // Signup no longer hands back a session (rule #58): a cookie for a new
    // account and none for an existing one would be the same leak restated.
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    return {
      cookie: res.headers["set-cookie"] as unknown as string[],
      id: res.body.user.id as string,
    }
  }

  async function partner(role: "admin" | "manager" | "staff", orgId = fx.aurora.org.id) {
    const g = await guest(`${role}${++n}@partner.test`)
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, g.id))
    await db.insert(partnerMembers).values({ orgId, userId: g.id, role, status: "active" })
    return g.cookie
  }

  async function admin() {
    const g = await guest(`root${++n}@stayora.test`)
    await db.update(users).set({ role: "admin", platformRole: "super_admin" }).where(eq(users.id, g.id))
    return g.cookie
  }

  const body = (over: Record<string, unknown> = {}) => ({
    name: "Autumn Escape",
    discountType: "percent",
    discountValue: 20,
    startDate: iso(1),
    endDate: iso(30),
    propertyIds: [fx.aurora.property.id],
    ...over,
  })

  const create = (cookie: string[], over: Record<string, unknown> = {}) =>
    request(server())
      .post("/api/v1/partner/promotions")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .send(body(over))

  const patch = (cookie: string[], id: string, payload: Record<string, unknown>) =>
    request(server()).patch(`/api/v1/partner/promotions/${id}`).set("Cookie", cookie).send(payload)

  beforeEach(async () => {
    await cleanup()
    fx = await seed()
  })

  /* ------------------------------------------------------------- creating */

  it("creates a promotion, which nothing could do before", async () => {
    const manager = await partner("manager")
    const res = await create(manager).expect(201)

    expect(res.body).toMatchObject({
      name: "Autumn Escape",
      discountType: "percent",
      discountValue: 20,
      // Nothing goes live by accident.
      status: "draft",
      channel: "all",
    })
    expect(res.body.propertyIds).toEqual([fx.aurora.property.id])
  })

  it("covers every room of a property when none are named (rule #21)", async () => {
    const manager = await partner("manager")
    const res = await create(manager).expect(201)
    expect(res.body.roomIds).toEqual([])
  })

  it("targets one room when asked", async () => {
    const manager = await partner("manager")
    const res = await create(manager, { roomIds: [fx.aurora.room.id] }).expect(201)
    expect(res.body.roomIds).toEqual([fx.aurora.room.id])
  })

  it("refuses front-desk staff (rule #14)", async () => {
    const staff = await partner("staff")
    await create(staff).expect(403)
  })

  /* --------------------------------------------------- the rules it must keep */

  it("refuses a discount that would pay the guest", async () => {
    const manager = await partner("manager")
    const res = await create(manager, { discountValue: 150 }).expect(400)
    expect(JSON.stringify(res.body)).toContain("100")
  })

  it("refuses a window that ends before it starts", async () => {
    const manager = await partner("manager")
    await create(manager, { startDate: iso(30), endDate: iso(1) }).expect(400)
  })

  it("refuses a promotion covering no property at all", async () => {
    const manager = await partner("manager")
    // Not a smaller promotion — a discount that reaches nobody.
    await create(manager, { propertyIds: [] }).expect(400)
  })

  /* ------------------------------------------------- reaching the guest (#3) */

  it("brings a genius promotion to life end to end (rule #3)", async () => {
    const manager = await partner("manager")
    const created = await create(manager, {
      channel: "genius",
      discountValue: 25,
      startDate: iso(0),
      status: "active",
    }).expect(201)
    expect(created.body.channel).toBe("genius")

    const g = await guest("loyal@example.com")

    // A standard account sees the ordinary price.
    const before = await quote(g.cookie)
    expect(before.body.pricing.discount).toBeUndefined()

    // The same account, once it carries the tier.
    await db.update(users).set({ tier: "genius" }).where(eq(users.id, g.id))
    const after = await quote(g.cookie)

    /*
     * The whole chain, working for the first time: a promotion exists, its
     * channel is `genius`, the account carries that tier, and the price moves.
     * Every link of it was written and tested months ago — and unreachable,
     * because nothing could create the promotion.
     */
    expect(after.body.pricing.discount).toBeDefined()
    expect(after.body.pricing.total).toBeLessThan(before.body.pricing.total)
  })

  const quote = (cookie: string[]) =>
    request(server())
      .post("/api/v1/properties/the-ritz-carlton/quote")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .send({
        roomId: fx.aurora.room.id,
        ratePlanId: fx.aurora.plan.id,
        checkIn: iso(10),
        checkOut: iso(13),
        adults: 2,
      })
      .expect(201)

  it("offers a draft promotion to nobody", async () => {
    const manager = await partner("manager")
    await create(manager, { startDate: iso(0), status: "draft" }).expect(201)

    const g = await guest()
    const res = await quote(g.cookie)
    expect(res.body.pricing.discount).toBeUndefined()
  })

  /* ------------------------------------------------------------ lifecycle */

  it("opens a scheduled promotion when its window arrives", async () => {
    const manager = await partner("manager")
    const created = await create(manager, {
      startDate: iso(0),
      endDate: iso(30),
      status: "scheduled",
    }).expect(201)

    // Until something moves it, `isApplicable` refuses it outright — the rule
    // was written and the job that makes it true was not.
    const g = await guest()
    expect((await quote(g.cookie)).body.pricing.discount).toBeUndefined()

    const swept = await promotionsService.sweepStatuses()
    expect(swept.activated).toBe(1)

    expect((await quote(g.cookie)).body.pricing.discount).toBeDefined()
    const [row] = await db.select().from(promotions).where(eq(promotions.id, created.body.id))
    expect(row!.status).toBe("active")
  })

  it("closes a promotion the day after its window", async () => {
    const manager = await partner("manager")
    const created = await create(manager, {
      startDate: iso(-30),
      endDate: iso(-1),
      status: "active",
    }).expect(201)

    const swept = await promotionsService.sweepStatuses()
    expect(swept.ended).toBe(1)

    const [row] = await db.select().from(promotions).where(eq(promotions.id, created.body.id))
    expect(row!.status).toBe("ended")
  })

  it("never publishes a draft, however long the window has been open", async () => {
    const manager = await partner("manager")
    const created = await create(manager, {
      startDate: iso(-30),
      endDate: iso(30),
      status: "draft",
    }).expect(201)

    await promotionsService.sweepStatuses()

    const [row] = await db.select().from(promotions).where(eq(promotions.id, created.body.id))
    // Publishing somebody's unfinished work is the one mistake they cannot undo.
    expect(row!.status).toBe("draft")
  })

  it("never un-pauses (rule #36's other half)", async () => {
    const manager = await partner("manager")
    const created = await create(manager, {
      startDate: iso(-1),
      endDate: iso(30),
      status: "paused",
    }).expect(201)

    await promotionsService.sweepStatuses()

    const [row] = await db.select().from(promotions).where(eq(promotions.id, created.body.id))
    expect(row!.status).toBe("paused")
  })

  it("is safe to sweep twice", async () => {
    const manager = await partner("manager")
    await create(manager, { startDate: iso(0), status: "scheduled" }).expect(201)

    const [a, b] = await Promise.all([
      promotionsService.sweepStatuses(),
      promotionsService.sweepStatuses(),
    ])
    // Guarded on the status it moves FROM, so only one run can move each.
    expect(a.activated + b.activated).toBe(1)
  })

  /* ------------------------------------------------------------- updating */

  it("changes one field without disturbing the rest", async () => {
    const manager = await partner("manager")
    const created = await create(manager, { roomIds: [fx.aurora.room.id] }).expect(201)

    const res = await patch(manager, created.body.id, { name: "Winter Escape" }).expect(200)

    /*
     * The trap this guards: a zod `.default()` survives `.partial()`, so a
     * PATCH of the name alone would arrive carrying `status: "draft"` and an
     * empty `roomIds` — quietly un-publishing the promotion and widening it
     * from one suite to the whole hotel.
     */
    expect(res.body.name).toBe("Winter Escape")
    expect(res.body.status).toBe("draft")
    expect(res.body.roomIds).toEqual([fx.aurora.room.id])
    expect(res.body.discountValue).toBe(20)
  })

  it("replaces the scope only when a new one is sent", async () => {
    const manager = await partner("manager")
    const created = await create(manager, { roomIds: [fx.aurora.room.id] }).expect(201)

    // An empty array means "every room" (rule #21) — different from absent.
    const res = await patch(manager, created.body.id, { roomIds: [] }).expect(200)
    expect(res.body.roomIds).toEqual([])
  })

  it("has no DELETE — a discounted booking has to stay explainable", async () => {
    const manager = await partner("manager")
    const created = await create(manager).expect(201)

    await request(server())
      .delete(`/api/v1/partner/promotions/${created.body.id}`)
      .set("Cookie", manager)
      .expect(404)

    await patch(manager, created.body.id, { status: "ended" }).expect(200)
  })

  /* ------------------------------------------------------------ the tier */

  it("earns genius on the second completed stay (rules #3, #53)", async () => {
    const g = await guest("loyal@example.com")
    const desk = await partner("manager")

    const stay = async () => {
      const [booking] = await db
        .insert(bookings)
        .values({
          ref: `STY-${String(++n).padStart(6, "0")}`,
          customerId: g.id,
          propertyId: fx.aurora.property.id,
          roomId: fx.aurora.room.id,
          ratePlanId: fx.aurora.plan.id,
          propertyName: "The Ritz-Carlton",
          roomName: "Deluxe King Room",
          ratePlanName: "Flexible",
          guestFirstName: "Amelia",
          guestLastName: "Hart",
          guestEmail: "loyal@example.com",
          checkIn: iso(-4),
          checkOut: iso(-1),
          adults: 2,
          total: 217_500,
          pricing: {
            nights: 3,
            nightlyRates: [72_500, 72_500, 72_500],
            ratePerNight: 72_500,
            roomSubtotal: 217_500,
            addOnsTotal: 0,
            total: 217_500,
          },
          cancelFreeUntil: "48h",
          cancelCharge: "percent",
          cancelChargeValue: 50,
          commissionRateBps: 1500,
          commissionAmount: 32_625,
          status: "checked_in",
        })
        .returning()

      await request(server())
        .patch(`/api/v1/bookings/${booking!.id}/status`)
        .set("Cookie", desk)
        .send({ status: "completed" })
        .expect(200)
    }

    const tierOf = async () => {
      const [row] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, g.id))
      return row!.tier
    }

    expect(await tierOf()).toBe("standard")
    await stay()
    expect(await tierOf()).toBe("standard")
    await stay()
    // The account can finally reach the channel that was built for it.
    expect(await tierOf()).toBe("genius")
  })

  it("does not count a booking that was never stayed", async () => {
    const g = await guest("canceller@example.com")

    await db.insert(bookings).values(
      [1, 2, 3].map((i) => ({
        ref: `STY-C${String(i).padStart(5, "0")}`,
        customerId: g.id,
        propertyId: fx.aurora.property.id,
        roomId: fx.aurora.room.id,
        ratePlanId: fx.aurora.plan.id,
        propertyName: "The Ritz-Carlton",
        roomName: "Deluxe King Room",
        ratePlanName: "Flexible",
        guestFirstName: "Amelia",
        guestLastName: "Hart",
        guestEmail: "canceller@example.com",
        checkIn: iso(-4),
        checkOut: iso(-1),
        adults: 2,
        total: 217_500,
        pricing: { nights: 3, nightlyRates: [], ratePerNight: 0, roomSubtotal: 0, addOnsTotal: 0, total: 0 },
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        commissionRateBps: 1500,
        commissionAmount: 0,
        status: "cancelled" as const,
        cancelledAt: new Date().toISOString(),
        cancelledBy: "guest" as const,
      }))
    )

    const [row] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, g.id))
    // Tying a discount to bookings rather than stays invites exactly this.
    expect(row!.tier).toBe("standard")
  })

  /* ------------------------------------------------------- SECURITY GATE -- */

  it("refuses an anonymous caller (API5)", async () => {
    await request(server()).post("/api/v1/partner/promotions").send(body()).expect(401)
    await request(server()).get("/api/v1/admin/promotions").expect(401)
  })

  it("refuses a guest and a partner the admin list (API5)", async () => {
    const g = await guest()
    const manager = await partner("manager")
    await request(server()).get("/api/v1/admin/promotions").set("Cookie", g.cookie).expect(403)
    await request(server()).get("/api/v1/admin/promotions").set("Cookie", manager).expect(403)
  })

  it("🔴 refuses to discount a rival's hotel (API1)", async () => {
    const manager = await partner("manager")

    // The attack this module exists to prevent: a caller who could name any
    // property id could put 90% off a competitor's rooms.
    const res = await create(manager, { propertyIds: [fx.rival.property.id] }).expect(404)
    expect(res.body.message).toContain("not found")

    expect(await db.select().from(promotions)).toHaveLength(0)
  })

  it("refuses a mix of owned and rival properties, rather than dropping one", async () => {
    const manager = await partner("manager")

    // Silently applying to three of five would tell a partner something false
    // about what they published.
    await create(manager, {
      propertyIds: [fx.aurora.property.id, fx.rival.property.id],
    }).expect(404)
  })

  it("refuses a room that sits in someone else's hotel (API1)", async () => {
    const manager = await partner("manager")
    await create(manager, { roomIds: [fx.rival.room.id] }).expect(404)
  })

  it("re-checks ownership on every scope change, not just the first", async () => {
    const manager = await partner("manager")
    const created = await create(manager).expect(201)

    // Created against one's own hotel, then edited to name a competitor's.
    await patch(manager, created.body.id, { propertyIds: [fx.rival.property.id] }).expect(404)

    const res = await request(server())
      .get(`/api/v1/partner/promotions/${created.body.id}`)
      .set("Cookie", manager)
      .expect(200)
    expect(res.body.propertyIds).toEqual([fx.aurora.property.id])
  })

  it("keeps a rival's promotions out of a partner's list (API1)", async () => {
    const rival = await partner("manager", fx.rival.org.id)
    await request(server())
      .post("/api/v1/partner/promotions")
      .set("Cookie", rival)
      .set("x-forwarded-for", freshIp())
      .send({ ...body(), propertyIds: [fx.rival.property.id] })
      .expect(201)

    const manager = await partner("manager")
    const res = await request(server())
      .get("/api/v1/partner/promotions")
      .set("Cookie", manager)
      .expect(200)
    expect(res.body).toHaveLength(0)
  })

  it("404s a rival's promotion — never 403 (API1)", async () => {
    const rival = await partner("manager", fx.rival.org.id)
    const theirs = await request(server())
      .post("/api/v1/partner/promotions")
      .set("Cookie", rival)
      .set("x-forwarded-for", freshIp())
      .send({ ...body(), propertyIds: [fx.rival.property.id] })
      .expect(201)

    const manager = await partner("manager")
    await request(server())
      .get(`/api/v1/partner/promotions/${theirs.body.id}`)
      .set("Cookie", manager)
      .expect(404)
    await patch(manager, theirs.body.id, { discountValue: 90 }).expect(404)
  })

  it("refuses the fields a partner does not own (API3)", async () => {
    const manager = await partner("manager")
    // `partnerOrgId` would hand the promotion to another org's books.
    for (const extra of [{ partnerOrgId: fx.rival.org.id }, { id: "x" }]) {
      await create(manager, extra).expect(400)
    }
  })

  it("caps what a caller can ask for (API4)", async () => {
    const manager = await partner("manager")
    await create(manager, {
      propertyIds: Array.from({ length: 300 }, () => fx.aurora.property.id),
    }).expect(400)
    await request(server())
      .get("/api/v1/partner/promotions?limit=5000")
      .set("Cookie", manager)
      .expect(400)
  })

  it("lets an admin see every org's promotions", async () => {
    const manager = await partner("manager")
    await create(manager).expect(201)

    const root = await admin()
    const res = await request(server())
      .get("/api/v1/admin/promotions")
      .set("Cookie", root)
      .expect(200)
    expect(res.body).toHaveLength(1)
  })
})
