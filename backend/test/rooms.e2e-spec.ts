import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { and, eq, gte } from "drizzle-orm"
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
  partnerMembers,
  partnerOrgs,
  paymentEvents,
  payments,
  properties,
  ratePlans,
  roomInventory,
  rooms,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"

const iso = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

const ROOM = {
  name: "Garden Suite",
  maxAdults: 2,
  maxChildren: 1,
  maxOccupancy: 3,
  units: 4,
}

const PLAN = {
  name: "Flexible",
  basePrice: 72_500,
  cancelFreeUntil: "48h",
  cancelCharge: "percent",
  cancelChargeValue: 50,
}

describe("rooms and rate plans", () => {
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
  const freshIp = () => `203.0.113.${++n % 250}`

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
          basePrice: 0,
          partnerOrgId: org!.id,
        })
        .returning()
      return { org: org!, property: property! }
    }

    return { aurora: await mkOrg("Aurora", "the-ritz-carlton"), rival: await mkOrg("Rival", "rival-hotel") }
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

  const createRoom = (cookie: string[], body: Record<string, unknown> = {}, propertyId?: string) =>
    request(server())
      .post(`/api/v1/partner/properties/${propertyId ?? fx.aurora.property.id}/rooms`)
      .set("Cookie", cookie)
      .send({ ...ROOM, ...body })

  const createPlan = (cookie: string[], roomId: string, body: Record<string, unknown> = {}) =>
    request(server())
      .post(`/api/v1/partner/rooms/${roomId}/rate-plans`)
      .set("Cookie", cookie)
      .send({ ...PLAN, ...body })

  const patchPlan = (cookie: string[], planId: string, body: Record<string, unknown>) =>
    request(server()).patch(`/api/v1/partner/rate-plans/${planId}`).set("Cookie", cookie).send(body)

  const patchRoom = (cookie: string[], roomId: string, body: Record<string, unknown>) =>
    request(server()).patch(`/api/v1/partner/rooms/${roomId}`).set("Cookie", cookie).send(body)

  beforeEach(async () => {
    await cleanup()
    fx = await seed()
  })

  /* ----------------------------------------------------------------- rooms */

  it("creates a room, which nothing could do before", async () => {
    const admin = await partner("admin")
    const res = await createRoom(admin).expect(201)

    expect(res.body).toMatchObject({ name: "Garden Suite", units: 4, status: "active" })
    expect(res.body).not.toHaveProperty("propertyId")
  })

  it("lets a manager run the rooms", async () => {
    // Rooms are operational. Needing the org's owner would stop the work.
    const manager = await partner("manager")
    const room = await createRoom(manager).expect(201)
    await patchRoom(manager, room.body.id, { name: "Garden Suite (renovated)" }).expect(200)
  })

  it("refuses front-desk staff (rule #14)", async () => {
    const staff = await partner("staff")
    await createRoom(staff).expect(403)
  })

  it("archives a room instead of deleting it", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)

    // There is no DELETE at all — bookings, inventory and payout lines point here.
    await request(server())
      .delete(`/api/v1/partner/rooms/${room.body.id}`)
      .set("Cookie", admin)
      .expect(404)

    const res = await patchRoom(admin, room.body.id, { status: "archived" }).expect(200)
    expect(res.body.room.status).toBe("archived")
  })

  it("retires a room's rate plans along with it", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)
    const plan = await createPlan(admin, room.body.id, { isDefault: true }).expect(201)

    await patchRoom(admin, room.body.id, { status: "archived" }).expect(200)

    const [row] = await db.select().from(ratePlans).where(eq(ratePlans.id, plan.body.id))
    // A live price on a room nobody can book is one the search still reads.
    expect(row!.status).toBe("archived")
    expect(row!.isDefault).toBe(false)
  })

  /* ------------------------------------------------- units and the calendar */

  it("moves the calendar when the unit count changes (rule #25)", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)

    // Materialise some future inventory at the original count.
    await db.insert(roomInventory).values(
      [0, 1, 2].map((offset) => ({
        roomId: room.body.id,
        date: iso(offset + 1),
        totalUnits: 4,
        sellableUnits: 4,
        bookedUnits: 0,
      }))
    )

    const res = await patchRoom(admin, room.body.id, { units: 6 }).expect(200)
    expect(res.body.units).toMatchObject({ applied: 3, blocked: [] })

    const after = await db.select().from(roomInventory).where(eq(roomInventory.roomId, room.body.id))
    expect(after.every((r) => r.sellableUnits === 6)).toBe(true)
  })

  it("leaves yesterday's inventory alone", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)

    await db.insert(roomInventory).values({
      roomId: room.body.id,
      date: iso(-5),
      totalUnits: 4,
      sellableUnits: 4,
      bookedUnits: 0,
    })

    await patchRoom(admin, room.body.id, { units: 6 }).expect(200)

    const [past] = await db
      .select()
      .from(roomInventory)
      .where(and(eq(roomInventory.roomId, room.body.id), eq(roomInventory.date, iso(-5))))
    // Past inventory is a record of what was sold, not a setting.
    expect(past!.sellableUnits).toBe(4)
  })

  it("will not un-sell a room that is already booked", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)

    await db.insert(roomInventory).values([
      { roomId: room.body.id, date: iso(1), totalUnits: 4, sellableUnits: 4, bookedUnits: 3 },
      { roomId: room.body.id, date: iso(2), totalUnits: 4, sellableUnits: 4, bookedUnits: 0 },
    ])

    const res = await patchRoom(admin, room.body.id, { units: 1 }).expect(200)

    // Applied where it could, named where it could not — rather than refusing
    // the whole change over one sold-out night.
    expect(res.body.units.applied).toBe(1)
    expect(res.body.units.blocked).toEqual([iso(1)])

    const rows = await db
      .select()
      .from(roomInventory)
      .where(and(eq(roomInventory.roomId, room.body.id), gte(roomInventory.date, iso(1))))
    const busy = rows.find((r) => r.date === iso(1))
    expect(busy!.sellableUnits).toBe(4)
  })

  /* ------------------------------------------------------------ rate plans */

  it("creates a rate plan and generates the sentence a guest reads (rule #1)", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)

    const res = await createPlan(admin, room.body.id).expect(201)

    expect(res.body.cancellationText).toContain("Free cancellation until 48 hours before check-in")
    expect(res.body.cancellationText).toContain("50% of the room rate is charged")
  })

  it("writes a no-show clause the moment a plan sets one (rule #47)", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)

    const res = await createPlan(admin, room.body.id, { noShowCharge: "full" }).expect(201)

    // The policy that could not be written down at all until now.
    expect(res.body.cancellationText).toContain("Free cancellation until 48 hours")
    expect(res.body.cancellationText).toContain("do not arrive")
  })

  it("moves the property's headline price to the cheapest live plan", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)
    await createPlan(admin, room.body.id, { basePrice: 72_500 }).expect(201)
    await createPlan(admin, room.body.id, { name: "Saver", basePrice: 58_000 }).expect(201)

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, fx.aurora.property.id))
    // A stale figure puts a hotel in a search band it can no longer honour.
    expect(property!.basePrice).toBe(58_000)
  })

  it("keeps an archived room's price out of the headline", async () => {
    const admin = await partner("admin")
    const cheap = await createRoom(admin, { name: "Cheap" }).expect(201)
    const suite = await createRoom(admin, { name: "Suite" }).expect(201)
    await createPlan(admin, cheap.body.id, { basePrice: 30_000 }).expect(201)
    await createPlan(admin, suite.body.id, { basePrice: 90_000 }).expect(201)

    await patchRoom(admin, cheap.body.id, { status: "archived" }).expect(200)

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, fx.aurora.property.id))
    expect(property!.basePrice).toBe(90_000)
  })

  it("allows exactly one default rate plan per room", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)
    const first = await createPlan(admin, room.body.id, { isDefault: true }).expect(201)
    const second = await createPlan(admin, room.body.id, { name: "Saver", isDefault: true }).expect(201)

    const plans = await db.select().from(ratePlans).where(eq(ratePlans.roomId, room.body.id))
    const defaults = plans.filter((p) => p.isDefault)

    // Two defaults means every screen reaching for "the default" picks
    // whichever the database happened to return first.
    expect(defaults).toHaveLength(1)
    expect(defaults[0]!.id).toBe(second.body.id)
    expect(first.body.id).not.toBe(second.body.id)
  })

  it("hands the default over when an existing plan claims it", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)
    const first = await createPlan(admin, room.body.id, { isDefault: true }).expect(201)
    const second = await createPlan(admin, room.body.id, { name: "Saver" }).expect(201)

    await patchPlan(admin, second.body.id, { isDefault: true }).expect(200)

    const plans = await db.select().from(ratePlans).where(eq(ratePlans.roomId, room.body.id))
    expect(plans.filter((p) => p.isDefault).map((p) => p.id)).toEqual([second.body.id])
    expect(plans.find((p) => p.id === first.body.id)!.isDefault).toBe(false)
  })

  /* ---------------------------------------------- price vs promise (RBAC) */

  it("lets a manager reprice", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)
    const plan = await createPlan(admin, room.body.id).expect(201)

    const manager = await partner("manager")
    const res = await patchPlan(manager, plan.body.id, { basePrice: 81_000 }).expect(200)
    expect(res.body.basePrice).toBe(81_000)
  })

  it("refuses a manager the cancellation, no-show and payment terms", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)
    const plan = await createPlan(admin, room.body.id).expect(201)
    const manager = await partner("manager")

    /*
     * These are not prices, they are promises — rules #1, #42, #47 — and every
     * one of them is enforceable against a guest's card. A different kind of
     * authority from choosing a nightly rate.
     */
    for (const body of [
      { cancelFreeUntil: "24h" },
      { cancelCharge: "full", cancelChargeValue: null },
      { noShowCharge: "full" },
      { paymentMode: "guarantee" },
    ]) {
      const res = await patchPlan(manager, plan.body.id, body).expect(403)
      expect(res.body.message).toContain("organisation admin")
    }
  })

  it("refuses a manager even when the term would not change", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)
    const plan = await createPlan(admin, room.body.id).expect(201)
    const manager = await partner("manager")

    // Sending a term its current value is still an attempt to write it. Reading
    // it as a no-op would make the rule depend on the row, not on who asks.
    await patchPlan(manager, plan.body.id, { cancelFreeUntil: "48h" }).expect(403)
  })

  it("lets an org admin change the terms", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)
    const plan = await createPlan(admin, room.body.id).expect(201)

    const res = await patchPlan(admin, plan.body.id, { noShowCharge: "full" }).expect(200)
    expect(res.body.cancellationText).toContain("do not arrive")
  })

  it("refuses a manager the power to create a plan at all", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)
    const manager = await partner("manager")

    // Creating a plan MEANS setting its terms, whatever the values happen to be.
    await createPlan(manager, room.body.id).expect(403)
  })

  /* -------------------------------------------------------- the rules hold */

  it("refuses a non-refundable rate that takes no money up front (rule #42)", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)

    const res = await createPlan(admin, room.body.id, {
      cancelFreeUntil: "non_refundable",
      cancelCharge: "full",
      cancelChargeValue: null,
      paymentMode: "guarantee",
    }).expect(400)
    expect(JSON.stringify(res.body)).toContain("paid up front")
  })

  it("refuses a percentage charge with no number", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)

    // It would charge 0% and read as a working policy.
    await createPlan(admin, room.body.id, { cancelChargeValue: null }).expect(400)
    await createPlan(admin, room.body.id, { noShowCharge: "percent" }).expect(400)
  })

  /* ------------------------------------------------------- SECURITY GATE -- */

  it("refuses an anonymous caller (API5)", async () => {
    await request(server())
      .post(`/api/v1/partner/properties/${fx.aurora.property.id}/rooms`)
      .send(ROOM)
      .expect(401)
  })

  it("refuses a guest (API5)", async () => {
    const g = await guest()
    await createRoom(g.cookie).expect(403)
  })

  it("404s a rival's property — never 403 (API1)", async () => {
    const admin = await partner("admin")
    const res = await createRoom(admin, {}, fx.rival.property.id).expect(404)
    // A 403 would confirm the property id is real.
    expect(res.body.message).toBe("Property not found")
  })

  it("404s a rival's room and rate plan (API1)", async () => {
    const rivalAdmin = await partner("admin", fx.rival.org.id)
    const theirRoom = await createRoom(rivalAdmin, {}, fx.rival.property.id).expect(201)
    const theirPlan = await createPlan(rivalAdmin, theirRoom.body.id).expect(201)

    const admin = await partner("admin")
    await patchRoom(admin, theirRoom.body.id, { units: 99 }).expect(404)
    await patchPlan(admin, theirPlan.body.id, { basePrice: 1 }).expect(404)
    await createPlan(admin, theirRoom.body.id).expect(404)
    await request(server())
      .get(`/api/v1/partner/rooms/${theirRoom.body.id}/rate-plans`)
      .set("Cookie", admin)
      .expect(404)
  })

  it("refuses the fields a property does not own (API3)", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)

    // `propertyId` would move a room into a competitor's hotel; `seed` and
    // `roomId` are the server's to assign.
    for (const body of [{ propertyId: fx.rival.property.id }, { seed: "x" }, { id: "x" }]) {
      await patchRoom(admin, room.body.id, body).expect(400)
    }
    const plan = await createPlan(admin, room.body.id).expect(201)
    await patchPlan(admin, plan.body.id, { roomId: room.body.id }).expect(400)
  })

  it("caps the sizes a caller can ask for (API4)", async () => {
    const admin = await partner("admin")
    await createRoom(admin, { units: 100_000 }).expect(400)
    await createRoom(admin, { name: "x".repeat(200) }).expect(400)
    await createRoom(admin, { features: Array.from({ length: 100 }, () => "x") }).expect(400)
  })

  it("refuses a negative price (API3)", async () => {
    const admin = await partner("admin")
    const room = await createRoom(admin).expect(201)
    await createPlan(admin, room.body.id, { basePrice: -1 }).expect(400)
  })

  /* ------------------------------------------------------------ value-adds */

  const createExtra = (cookie: string[], over: Record<string, unknown> = {}, propertyId?: string) =>
    request(server())
      .post(`/api/v1/partner/properties/${propertyId ?? fx.aurora.property.id}/value-adds`)
      .set("Cookie", cookie)
      .send({ name: "Airport transfer", price: 6_500, ...over })

  const patchExtra = (cookie: string[], id: string, body: Record<string, unknown>) =>
    request(server()).patch(`/api/v1/partner/value-adds/${id}`).set("Cookie", cookie).send(body)

  it("creates an extra, which nothing could do before", async () => {
    const manager = await partner("manager")
    const res = await createExtra(manager).expect(201)

    expect(res.body).toMatchObject({
      name: "Airport transfer",
      price: 6_500,
      unit: "per_stay",
      category: "general",
      active: true,
    })
  })

  it("prices a daily extra per person per night (rule #10)", async () => {
    const manager = await partner("manager")

    // The unit the prototype lacked: "Daily breakfast" was priced per_person
    // and charged $32 once for a three-night stay.
    const res = await createExtra(manager, {
      name: "Daily breakfast",
      price: 3_200,
      unit: "per_person_per_night",
    }).expect(201)

    expect(res.body.unit).toBe("per_person_per_night")
  })

  it("retires an extra instead of deleting it", async () => {
    const manager = await partner("manager")
    const extra = await createExtra(manager).expect(201)

    // A booking's add-ons reference these rows — "what was this $65 line" has
    // to stay answerable.
    await request(server())
      .delete(`/api/v1/partner/value-adds/${extra.body.id}`)
      .set("Cookie", manager)
      .expect(404)

    const res = await patchExtra(manager, extra.body.id, { active: false }).expect(200)
    expect(res.body.active).toBe(false)
  })

  it("changes one field without disturbing the rest", async () => {
    const manager = await partner("manager")
    const extra = await createExtra(manager, {
      description: "Mercedes S-Class, both ways",
      unit: "per_night",
    }).expect(201)

    const res = await patchExtra(manager, extra.body.id, { price: 7_000 }).expect(200)

    // The `.partial()` + `.default()` trap again: a price change must not wipe
    // the description or reset the unit to `per_stay`.
    expect(res.body).toMatchObject({
      price: 7_000,
      description: "Mercedes S-Class, both ways",
      unit: "per_night",
    })
  })

  it("refuses front-desk staff (rule #14)", async () => {
    const staff = await partner("staff")
    await createExtra(staff).expect(403)
  })

  it("404s a rival's property and extra (API1)", async () => {
    const rivalManager = await partner("admin", fx.rival.org.id)
    const theirs = await createExtra(rivalManager, {}, fx.rival.property.id).expect(201)

    const manager = await partner("manager")
    await createExtra(manager, {}, fx.rival.property.id).expect(404)
    await patchExtra(manager, theirs.body.id, { price: 1 }).expect(404)
    await request(server())
      .get(`/api/v1/partner/properties/${fx.rival.property.id}/value-adds`)
      .set("Cookie", manager)
      .expect(404)
  })

  it("refuses an anonymous caller and a guest (API5)", async () => {
    await request(server())
      .post(`/api/v1/partner/properties/${fx.aurora.property.id}/value-adds`)
      .send({ name: "X", price: 1 })
      .expect(401)

    const g = await guest()
    await createExtra(g.cookie).expect(403)
  })

  it("refuses the fields a partner does not own, and a negative price (API3)", async () => {
    const manager = await partner("manager")
    await createExtra(manager, { propertyId: fx.rival.property.id }).expect(400)
    await createExtra(manager, { price: -1 }).expect(400)
    await createExtra(manager, { unit: "per_fortnight" }).expect(400)
  })
})
