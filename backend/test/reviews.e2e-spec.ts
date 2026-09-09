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
import {
  bookings,
  notificationOutbox,
  paymentEvents,
  partnerMembers,
  payments,
  partnerOrgs,
  properties,
  ratePlans,
  reviews,
  rooms,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"

const iso = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

const GOOD = {
  rating: 5,
  categories: { cleanliness: 5, comfort: 4, location: 5, facilities: 4, staff: 5 },
  title: "Faultless from arrival to checkout",
  body: "The suite overlooked the park and the concierge remembered our name.",
}

describe("reviews", () => {
  let app: NestExpressApplication
  let db: Database

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
    const [org] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora", status: "active", commissionRateBps: 1500 })
      .returning()
    const [rival] = await db
      .insert(partnerOrgs)
      .values({ name: "Rival Group", status: "active", commissionRateBps: 1200 })
      .returning()

    const [ritz] = await db
      .insert(properties)
      .values({
        slug: "the-ritz-carlton",
        name: "The Ritz-Carlton",
        city: "New York",
        country: "USA",
        timezone: "America/New_York",
        checkInTime: "15:00",
        status: "active",
        basePrice: 72_500,
        partnerOrgId: org!.id,
      })
      .returning()
    const [other] = await db
      .insert(properties)
      .values({
        slug: "rival-hotel",
        name: "Rival Hotel",
        city: "New York",
        country: "USA",
        timezone: "America/New_York",
        checkInTime: "15:00",
        status: "active",
        basePrice: 40_000,
        partnerOrgId: rival!.id,
      })
      .returning()

    const [deluxe] = await db
      .insert(rooms)
      .values({
        propertyId: ritz!.id,
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
        roomId: deluxe!.id,
        name: "Flexible",
        basePrice: 72_500,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        isDefault: true,
      })
      .returning()

    return { org: org!, rival: rival!, ritz: ritz!, other: other!, deluxe: deluxe!, plan: plan! }
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

  async function partner(email: string, role: "admin" | "manager" | "staff", orgId = fx.org.id) {
    const g = await guest(email)
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, g.id))
    await db.insert(partnerMembers).values({ orgId, userId: g.id, role, status: "active" })
    return g.cookie
  }

  async function admin(email = "root@stayora.test") {
    const g = await guest(email)
    await db.update(users).set({ role: "admin", platformRole: "super_admin" }).where(eq(users.id, g.id))
    return g.cookie
  }

  /**
   * A stay, written straight to the table.
   *
   * Booking through the API would drag the whole pricing and inventory path
   * into a suite about reviews; what matters here is the STATE a review is
   * written against, and these are the states rule #39 turns on.
   */
  async function stay(customerId: string, over: Record<string, unknown> = {}) {
    const [row] = await db
      .insert(bookings)
      .values({
        ref: `STY-${String(++n).padStart(6, "0")}`,
        customerId,
        propertyId: fx.ritz.id,
        roomId: fx.deluxe.id,
        ratePlanId: fx.plan.id,
        propertyName: "The Ritz-Carlton",
        roomName: "Deluxe King Room",
        ratePlanName: "Flexible",
        guestFirstName: "Amelia",
        guestLastName: "Hart",
        guestEmail: "amelia@example.com",
        guestCountry: "United Kingdom",
        checkIn: iso(-10),
        checkOut: iso(-7),
        adults: 2,
        nights: 3,
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
        status: "completed",
        ...over,
      })
      .returning()
    return row!
  }

  const write = (cookie: string[], bookingId: string, over: Record<string, unknown> = {}) =>
    request(server())
      .post("/api/v1/reviews")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .send({ bookingId, ...GOOD, ...over })

  beforeEach(async () => {
    await cleanup()
    fx = await seed()
  })

  /* ----------------------------------------------------------------- write */

  it("writes a review against a completed stay, published immediately (rule #40)", async () => {
    const g = await guest()
    const booking = await stay(g.id)

    const res = await write(g.cookie, booking.id).expect(201)

    expect(res.body).toMatchObject({
      status: "published",
      verified: true,
      rating: 5,
      title: GOOD.title,
      propertyId: fx.ritz.id,
      roomName: "Deluxe King Room",
    })
  })

  it("refuses a body that names the property, the author or the status", async () => {
    const g = await guest()
    const booking = await stay(g.id)

    // `.strict()` — unknown fields are refused outright rather than ignored,
    // so nobody has to remember to strip them (API3, input side).
    for (const extra of [
      { propertyId: fx.other.id },
      { author: "Somebody Else" },
      { status: "flagged" },
      { date: "1999-01-01" },
    ]) {
      await write(g.cookie, booking.id, extra).expect(400)
    }
  })

  it("derives the author and their country from the account and the stay", async () => {
    const g = await guest()
    const booking = await stay(g.id)
    const res = await write(g.cookie, booking.id).expect(201)

    expect(res.body.author).toBe("Amelia Hart")
    expect(res.body.country).toBe("United Kingdom")
  })

  /* ----------------------------------------------------- eligibility (#39) */

  it("refuses a stay that has not completed", async () => {
    const g = await guest()
    const states: Record<string, unknown>[] = [
      { status: "confirmed" },
      { status: "checked_in" },
      { status: "no_show" },
      // A cancelled booking must carry its cancellation, or the table refuses
      // it before this test can make its point.
      { status: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: "guest" },
    ]

    for (const state of states) {
      const booking = await stay(g.id, state)
      const res = await write(g.cookie, booking.id).expect(400)
      expect(res.body.code).toBe("not_stayed")
    }
  })

  it("refuses a second review of the same stay", async () => {
    const g = await guest()
    const booking = await stay(g.id)

    await write(g.cookie, booking.id).expect(201)
    const second = await write(g.cookie, booking.id).expect(400)
    expect(second.body.code).toBe("already_reviewed")
  })

  it("closes the window 90 days after checkout", async () => {
    const g = await guest()
    const stale = await stay(g.id, { checkIn: iso(-95), checkOut: iso(-91) })

    const res = await write(g.cookie, stale.id).expect(400)
    expect(res.body.code).toBe("window_closed")
  })

  it("still accepts one written on the ninetieth day", async () => {
    const g = await guest()
    const booking = await stay(g.id, { checkIn: iso(-94), checkOut: iso(-90) })
    await write(g.cookie, booking.id).expect(201)
  })

  it("lets exactly ONE of two simultaneous submissions win", async () => {
    const g = await guest()
    const booking = await stay(g.id)

    const [a, b] = await Promise.all([write(g.cookie, booking.id), write(g.cookie, booking.id)])

    // Exactly one row, and exactly one caller told they wrote it. The loser
    // gets 400 or 409 depending on whether it lost at the eligibility check or
    // at the unique index — both are correct refusals, and which one fires is
    // a matter of microseconds, so the test asserts the guarantee rather than
    // the timing.
    const created = [a.status, b.status].filter((s) => s === 201)
    expect(created).toHaveLength(1)
    expect([a.status, b.status].filter((s) => s === 400 || s === 409)).toHaveLength(1)

    const rows = await db.select().from(reviews)
    expect(rows).toHaveLength(1)
  })

  it("refuses a second review of the same stay at the table, not just in code", async () => {
    const g = await guest()
    const booking = await stay(g.id)
    await write(g.cookie, booking.id).expect(201)

    await expect(
      db.insert(reviews).values({
        propertyId: fx.ritz.id,
        bookingId: booking.id,
        author: "Direct Insert",
        rating: 1,
        categories: GOOD.categories,
        title: "t",
        body: "b",
        date: iso(0),
      })
    ).rejects.toThrow()
  })

  it("still lets imported reviews, which have no booking, sit side by side", async () => {
    // The UNIQUE on `booking_id` works because Postgres treats NULLs as
    // distinct — the opposite of how some engines behave, so it is asserted.
    for (const author of ["Imported One", "Imported Two"]) {
      await db.insert(reviews).values({
        propertyId: fx.ritz.id,
        author,
        rating: 4,
        categories: GOOD.categories,
        title: "From an OTA",
        body: "Imported with no account behind it.",
        date: iso(-1),
      })
    }

    const res = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews")
      .expect(200)
    expect(res.body.items).toHaveLength(2)
    // No booking, no badge.
    expect(res.body.items.every((r: { verified: boolean }) => r.verified === false)).toBe(true)
  })

  /* ---------------------------------------------------------------- rating */

  it("derives the property rating from published reviews only", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    await write(a.cookie, (await stay(a.id)).id).expect(201)
    await write(b.cookie, (await stay(b.id)).id, { rating: 3 }).expect(201)

    const res = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews")
      .expect(200)

    expect(res.body.rating).toMatchObject({ rating: 4, reviewCount: 2 })
    // (5+3)/2 = 4 · cleanliness (5+5)/2 = 5 · comfort (4+4)/2 = 4
    expect(res.body.rating.categories).toMatchObject({ cleanliness: 5, comfort: 4 })
  })

  it("agrees with the domain's own arithmetic on an awkward average", async () => {
    // 5, 4, 4 → 4.333… → 4.3. The SQL sums and `ratingFromTotals` divides, so
    // there is only ever one implementation of this rounding.
    for (const [i, rating] of [5, 4, 4].entries()) {
      const g = await guest(`avg${i}@example.com`)
      await write(g.cookie, (await stay(g.id)).id, { rating }).expect(201)
    }

    const res = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews")
      .expect(200)
    expect(res.body.rating.rating).toBe(4.3)
  })

  it("reports zero for a property nobody has reviewed", async () => {
    const res = await request(server()).get("/api/v1/properties/rival-hotel/reviews").expect(200)
    expect(res.body).toMatchObject({ items: [], rating: { rating: 0, reviewCount: 0 } })
  })

  it("puts the rating on the listing card and the detail page", async () => {
    const g = await guest()
    await write(g.cookie, (await stay(g.id)).id, { rating: 4 }).expect(201)

    const detail = await request(server())
      .get("/api/v1/properties/the-ritz-carlton")
      .expect(200)
    expect(detail.body.rating).toMatchObject({ rating: 4, reviewCount: 1 })

    const list = await request(server()).get("/api/v1/properties?city=New%20York").expect(200)
    const card = list.body.items.find((i: { slug: string }) => i.slug === "the-ritz-carlton")
    expect(card.rating).toMatchObject({ rating: 4, reviewCount: 1 })
  })

  /* ------------------------------------------------------------ the guest */

  it("lists the stays a guest can still write about", async () => {
    const g = await guest()
    const fresh = await stay(g.id)
    await stay(g.id, { status: "confirmed", checkIn: iso(5), checkOut: iso(8) })
    await stay(g.id, { checkIn: iso(-120), checkOut: iso(-100) })

    const before = await request(server())
      .get("/api/v1/reviews/reviewable")
      .set("Cookie", g.cookie)
      .expect(200)

    // The upcoming stay has not happened; the old one is outside the window.
    expect(before.body).toHaveLength(1)
    expect(before.body[0].id).toBe(fresh.id)

    await write(g.cookie, fresh.id).expect(201)

    const after = await request(server())
      .get("/api/v1/reviews/reviewable")
      .set("Cookie", g.cookie)
      .expect(200)
    expect(after.body).toHaveLength(0)
  })

  it("shows a guest their own review even after it is flagged", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const manager = await partner("m@aurora.test", "manager")

    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/flag`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "We dispute the description of the arrival experience." })
      .expect(201)

    const mine = await request(server())
      .get("/api/v1/reviews/mine")
      .set("Cookie", g.cookie)
      .expect(200)

    // Their own words stay visible to them — otherwise the review just vanishes.
    expect(mine.body.items).toHaveLength(1)
    expect(mine.body.items[0].status).toBe("flagged")
  })

  it("keeps one guest's reviews out of another's list (API1)", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    await write(a.cookie, (await stay(a.id)).id).expect(201)

    const res = await request(server())
      .get("/api/v1/reviews/mine")
      .set("Cookie", b.cookie)
      .expect(200)
    expect(res.body.items).toHaveLength(0)
  })

  it("counts the partner's whole queue, not just the page", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    const first = await write(a.cookie, (await stay(a.id)).id).expect(201)
    await write(b.cookie, (await stay(b.id)).id).expect(201)

    const manager = await partner("m@aurora.test", "manager")
    await request(server())
      .post(`/api/v1/partner/reviews/${first.body.id}/flag`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "The room described here is not one we let out." })
      .expect(201)

    const res = await request(server())
      .get("/api/v1/partner/reviews?limit=1")
      .set("Cookie", manager)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.counts).toEqual({ published: 1, flagged: 1 })
  })

  /* -------------------------------------------------------- withdraw (#41) */

  it("lets a guest take their own review down, and the rating follows", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    const mine = await write(a.cookie, (await stay(a.id)).id).expect(201)
    await write(b.cookie, (await stay(b.id)).id, { rating: 3 }).expect(201)

    const res = await request(server())
      .delete(`/api/v1/reviews/${mine.body.id}`)
      .set("Cookie", a.cookie)
      .expect(200)
    expect(res.body.status).toBe("withdrawn")

    const publicList = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews")
      .expect(200)
    expect(publicList.body.items).toHaveLength(1)
    expect(publicList.body.rating).toMatchObject({ rating: 3, reviewCount: 1 })
  })

  it("does NOT hand the booking back for a kinder second attempt (#41)", async () => {
    const g = await guest()
    const booking = await stay(g.id)
    const created = await write(g.cookie, booking.id, { rating: 2 }).expect(201)

    await request(server())
      .delete(`/api/v1/reviews/${created.body.id}`)
      .set("Cookie", g.cookie)
      .expect(200)

    // The whole point: withdraw is not a do-over, or "pull the two-star and
    // write a nicer one" becomes something a property can lean on a guest for.
    const again = await write(g.cookie, booking.id, { rating: 5 }).expect(400)
    expect(again.body.code).toBe("already_reviewed")

    const reviewable = await request(server())
      .get("/api/v1/reviews/reviewable")
      .set("Cookie", g.cookie)
      .expect(200)
    expect(reviewable.body).toHaveLength(0)
  })

  it("keeps a withdrawn review visible to its own author", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    await request(server())
      .delete(`/api/v1/reviews/${created.body.id}`)
      .set("Cookie", g.cookie)
      .expect(200)

    const mine = await request(server())
      .get("/api/v1/reviews/mine")
      .set("Cookie", g.cookie)
      .expect(200)
    expect(mine.body.items).toHaveLength(1)
    expect(mine.body.items[0].status).toBe("withdrawn")
  })

  it("lets a guest withdraw a review a partner has flagged", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const manager = await partner("m@aurora.test", "manager")

    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/flag`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "We dispute the account of the arrival given here." })
      .expect(201)

    // Their words, whatever the dispute — withdrawing simply ends it.
    await request(server())
      .delete(`/api/v1/reviews/${created.body.id}`)
      .set("Cookie", g.cookie)
      .expect(200)
  })

  it("refuses to withdraw a review a moderator already rejected", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const manager = await partner("m@aurora.test", "manager")
    const root = await admin()

    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/flag`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Contains the personal details of a member of staff." })
      .expect(201)
    await request(server())
      .patch(`/api/v1/admin/reviews/${created.body.id}`)
      .set("Cookie", root)
      .send({ status: "rejected", reason: "Confirmed - personal data." })
      .expect(200)

    // Already gone, and relabelling a moderator's decision as the author's own
    // choice would rewrite what actually happened.
    await request(server())
      .delete(`/api/v1/reviews/${created.body.id}`)
      .set("Cookie", g.cookie)
      .expect(400)
  })

  it("404s an attempt to withdraw somebody else's review (API1)", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    const created = await write(a.cookie, (await stay(a.id)).id).expect(201)

    const res = await request(server())
      .delete(`/api/v1/reviews/${created.body.id}`)
      .set("Cookie", b.cookie)
      .expect(404)
    expect(res.body.message).toBe("Review not found")

    // And it is still there, untouched.
    const publicList = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews")
      .expect(200)
    expect(publicList.body.items).toHaveLength(1)
  })

  it("refuses a partner and an admin the withdraw button (#41)", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const manager = await partner("m@aurora.test", "manager")
    const root = await admin()

    // A withdrawal reads as the guest's own doing, so only the guest may do it.
    await request(server())
      .delete(`/api/v1/reviews/${created.body.id}`)
      .set("Cookie", manager)
      .expect(404)
    await request(server())
      .delete(`/api/v1/reviews/${created.body.id}`)
      .set("Cookie", root)
      .expect(404)

    // And an admin cannot reach the state through moderation either.
    await request(server())
      .patch(`/api/v1/admin/reviews/${created.body.id}`)
      .set("Cookie", root)
      .send({ status: "withdrawn" })
      .expect(400)
  })

  it("will not let an admin republish what the author withdrew", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const root = await admin()

    await request(server())
      .delete(`/api/v1/reviews/${created.body.id}`)
      .set("Cookie", g.cookie)
      .expect(200)

    const res = await request(server())
      .patch(`/api/v1/admin/reviews/${created.body.id}`)
      .set("Cookie", root)
      .send({ status: "published" })
      .expect(400)
    expect(res.body.message).toContain("withdrew")
  })

  it("refuses a partner reply on a review nobody can read", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const manager = await partner("m@aurora.test", "manager")

    await request(server())
      .delete(`/api/v1/reviews/${created.body.id}`)
      .set("Cookie", g.cookie)
      .expect(200)

    // Storing it would only leave the property believing they answered.
    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/respond`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ text: "Sorry to hear this." })
      .expect(400)
  })

  it("settles two withdrawals racing each other", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)

    const pull = () =>
      request(server()).delete(`/api/v1/reviews/${created.body.id}`).set("Cookie", g.cookie)

    const [a, b] = await Promise.all([pull(), pull()])
    expect([a.status, b.status].filter((s) => s === 200)).toHaveLength(1)
    expect([a.status, b.status].filter((s) => s === 400)).toHaveLength(1)
  })

  /* ------------------------------------------------------------ moderation */

  it("removes a flagged review from the public list AND the rating at once", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    const first = await write(a.cookie, (await stay(a.id)).id).expect(201)
    await write(b.cookie, (await stay(b.id)).id, { rating: 1 }).expect(201)

    const manager = await partner("m@aurora.test", "manager")
    await request(server())
      .post(`/api/v1/partner/reviews/${first.body.id}/flag`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "This guest never stayed with us - the name is not on the register." })
      .expect(201)

    const res = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews")
      .expect(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.rating).toMatchObject({ rating: 1, reviewCount: 1 })
  })

  it("lets an admin reinstate a flagged review, and the rating follows", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const manager = await partner("m@aurora.test", "manager")
    const root = await admin()

    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/flag`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "We believe this review is about a different property." })
      .expect(201)

    const queue = await request(server())
      .get("/api/v1/admin/reviews")
      .set("Cookie", root)
      .expect(200)
    expect(queue.body.items).toHaveLength(1)
    expect(queue.body.items[0].flagReason).toContain("different property")

    await request(server())
      .patch(`/api/v1/admin/reviews/${created.body.id}`)
      .set("Cookie", root)
      .send({ status: "published" })
      .expect(200)

    const res = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews")
      .expect(200)
    expect(res.body.rating.reviewCount).toBe(1)
    // The partner's objection is not part of the public shape at all — not
    // "null on published rows", ABSENT, so a missed clear cannot publish it.
    expect(res.body.items[0]).not.toHaveProperty("flagReason")
    expect(res.body.items[0]).not.toHaveProperty("status")
  })

  it("keeps a rejected review out of the public list for good", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const manager = await partner("m@aurora.test", "manager")
    const root = await admin()

    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/flag`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Contains the personal details of a member of staff." })
      .expect(201)

    await request(server())
      .patch(`/api/v1/admin/reviews/${created.body.id}`)
      .set("Cookie", root)
      .send({ status: "rejected", reason: "Confirmed - personal data." })
      .expect(200)

    const res = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews")
      .expect(200)
    expect(res.body.items).toHaveLength(0)
    expect(res.body.rating.reviewCount).toBe(0)
  })

  it("refuses a flag with no real reason - that would be a delete button", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const manager = await partner("m@aurora.test", "manager")

    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/flag`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "spam" })
      .expect(400)
  })

  it("settles two moderators acting at once, so only one decision lands", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const manager = await partner("m@aurora.test", "manager")

    const flag = () =>
      request(server())
        .post(`/api/v1/partner/reviews/${created.body.id}/flag`)
        .set("Cookie", manager)
        .set("x-forwarded-for", freshIp())
        .send({ reason: "Duplicate of a review already reported to you last week." })

    const [a, b] = await Promise.all([flag(), flag()])

    // One decision lands. The loser is refused either by the status check or
    // by the guarded UPDATE — 400 or 409, both correct.
    expect([a.status, b.status].filter((s) => s === 201)).toHaveLength(1)
    expect([a.status, b.status].filter((s) => s === 400 || s === 409)).toHaveLength(1)

    const rows = await db.select().from(reviews)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.status).toBe("flagged")
  })

  /* --------------------------------------------------------------- replies */

  it("lets a partner reply, and correct their own reply afterwards", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const manager = await partner("m@aurora.test", "manager")

    const res = await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/respond`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ text: "Thank you Amelia - we have shared this with the concierge team." })
      .expect(201)

    expect(res.body.response.text).toContain("concierge team")
    expect(res.body.response.at).toBeTruthy()

    // The property's own words: a typo in a public reply must not be permanent.
    const edited = await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/respond`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ text: "Thank you Amelia - we have shared this with our concierge team." })
      .expect(201)

    expect(edited.body.response.text).toContain("our concierge team")

    const publicList = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews")
      .expect(200)
    expect(publicList.body.items[0].response.text).toContain("our concierge team")
  })

  it("refuses front-desk staff a reply or a flag (rule #14)", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const desk = await partner("desk@aurora.test", "staff")

    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/respond`)
      .set("Cookie", desk)
      .set("x-forwarded-for", freshIp())
      .send({ text: "Cheers!" })
      .expect(403)

    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/flag`)
      .set("Cookie", desk)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "I do not like what this one says about our lobby." })
      .expect(403)
  })

  /* ------------------------------------------------------- SECURITY GATE -- */

  it("refuses an anonymous write (API5)", async () => {
    const g = await guest()
    const booking = await stay(g.id)

    await request(server())
      .post("/api/v1/reviews")
      .set("x-forwarded-for", freshIp())
      .send({ bookingId: booking.id, ...GOOD })
      .expect(401)
  })

  it("404s somebody else's booking - never 403 (API1)", async () => {
    const owner = await guest("owner@example.com")
    const stranger = await guest("stranger@example.com")
    const booking = await stay(owner.id)

    const res = await write(stranger.cookie, booking.id).expect(404)
    // A 403 would confirm the id is real, which is the leak itself.
    expect(res.body.message).toBe("Booking not found")
  })

  it("404s a review of a property the partner does not own (API1)", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const outsider = await partner("boss@rival.test", "admin", fx.rival.id)

    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/respond`)
      .set("Cookie", outsider)
      .set("x-forwarded-for", freshIp())
      .send({ text: "Reviewing the competition." })
      .expect(404)

    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/flag`)
      .set("Cookie", outsider)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "I would rather this review of my rival did not exist." })
      .expect(404)
  })

  it("keeps a rival's reviews out of a partner's list (API1)", async () => {
    const g = await guest()
    await write(g.cookie, (await stay(g.id)).id).expect(201)

    const outsider = await partner("boss@rival.test", "admin", fx.rival.id)
    const res = await request(server())
      .get("/api/v1/partner/reviews")
      .set("Cookie", outsider)
      .expect(200)

    expect(res.body.items).toHaveLength(0)
  })

  it("refuses a guest and a partner the moderation queue (API5)", async () => {
    const g = await guest()
    const manager = await partner("m@aurora.test", "manager")

    await request(server()).get("/api/v1/admin/reviews").set("Cookie", g.cookie).expect(403)
    await request(server()).get("/api/v1/admin/reviews").set("Cookie", manager).expect(403)
  })

  it("gives the public no way to read flagged reviews (API3)", async () => {
    const g = await guest()
    const created = await write(g.cookie, (await stay(g.id)).id).expect(201)
    const manager = await partner("m@aurora.test", "manager")

    await request(server())
      .post(`/api/v1/partner/reviews/${created.body.id}/flag`)
      .set("Cookie", manager)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "We dispute the account of the check-in given here." })
      .expect(201)

    // The filter the moderation queue uses does not exist on the open route.
    await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews?status=flagged")
      .expect(400)

    const plain = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews")
      .expect(200)
    expect(plain.body.items).toHaveLength(0)
  })

  it("hides the reviews of a property that is no longer listed", async () => {
    const g = await guest()
    await write(g.cookie, (await stay(g.id)).id).expect(201)
    await db.update(properties).set({ status: "suspended" }).where(eq(properties.id, fx.ritz.id))

    await request(server()).get("/api/v1/properties/the-ritz-carlton/reviews").expect(404)
  })

  it("caps the page size (API4)", async () => {
    await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews?limit=5000")
      .expect(400)
  })

  it("pages with a keyset cursor rather than an offset", async () => {
    for (let i = 0; i < 3; i++) {
      const g = await guest(`page${i}@example.com`)
      await write(g.cookie, (await stay(g.id)).id).expect(201)
    }

    const first = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews?limit=2")
      .expect(200)
    expect(first.body.items).toHaveLength(2)
    expect(first.body.nextCursor).toBeTruthy()

    const second = await request(server())
      .get(`/api/v1/properties/the-ritz-carlton/reviews?limit=2&cursor=${first.body.nextCursor}`)
      .expect(200)
    expect(second.body.items).toHaveLength(1)
    expect(second.body.nextCursor).toBeNull()

    const ids = [...first.body.items, ...second.body.items].map((r: { id: string }) => r.id)
    expect(new Set(ids).size).toBe(3)
  })

  it("treats a forged cursor as the first page, not a server error", async () => {
    const g = await guest()
    await write(g.cookie, (await stay(g.id)).id).expect(201)

    const res = await request(server())
      .get("/api/v1/properties/the-ritz-carlton/reviews?cursor=Jzsgel9C")
      .expect(200)
    expect(res.body.items).toHaveLength(1)
  })

  it("refuses a rating outside 1-5, at the contract and at the table", async () => {
    const g = await guest()
    const booking = await stay(g.id)

    await write(g.cookie, booking.id, { rating: 6 }).expect(400)
    await write(g.cookie, booking.id, { rating: 0 }).expect(400)
    await write(g.cookie, booking.id, { categories: { ...GOOD.categories, staff: 9 } }).expect(400)

    // And the constraint holds even when the contract is bypassed entirely.
    await expect(
      db.insert(reviews).values({
        propertyId: fx.ritz.id,
        author: "Direct Insert",
        rating: 6,
        categories: GOOD.categories,
        title: "t",
        body: "b",
        date: iso(0),
      })
    ).rejects.toThrow()
  })

  it("refuses an oversized body (API4)", async () => {
    const g = await guest()
    const booking = await stay(g.id)
    await write(g.cookie, booking.id, { body: "x".repeat(5_001) }).expect(400)
  })

  it("stores the review as text, not as markup the property page will render", async () => {
    const g = await guest()
    const booking = await stay(g.id)
    const payload = "<script>alert(document.cookie)</script> lovely stay"

    const res = await write(g.cookie, booking.id, { body: payload }).expect(201)
    // Kept verbatim and escaped at render, rather than silently rewritten:
    // stripping here would change what a guest wrote and still leave the next
    // sink unprotected.
    expect(res.body.body).toBe(payload)
  })
})
