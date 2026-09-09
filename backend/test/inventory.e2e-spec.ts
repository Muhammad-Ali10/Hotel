import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { asc, eq } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { resetDb } from "./support/reset-db"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import {
  notificationOutbox,
  partnerMembers,
  partnerOrgs,
  properties,
  ratePlanRates,
  ratePlans,
  roomInventory,
  rooms,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"

/** Dates well inside the booking horizon, independent of the real clock. */
const iso = (offsetDays: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}

describe("inventory", () => {
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
  let ipCounter = 0
  const freshIp = () => `192.0.2.${++ipCounter % 250}`

  type Fixture = Awaited<ReturnType<typeof seed>>
  let fx: Fixture

  async function seed() {
    const [aurora] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora Hospitality", status: "active" })
      .returning()
    const [rival] = await db
      .insert(partnerOrgs)
      .values({ name: "Rival Group", status: "active" })
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
        basePrice: 62_000,
        partnerOrgId: aurora!.id,
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
        units: 3,
      })
      .returning()

    const [flexible] = await db
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

    const [nonRefundable] = await db
      .insert(ratePlans)
      .values({
        roomId: deluxe!.id,
        name: "Non-refundable",
        basePrice: 62_000,
        cancelFreeUntil: "non_refundable",
        cancelCharge: "full",
      })
      .returning()

    return {
      aurora: aurora!,
      rival: rival!,
      ritz: ritz!,
      deluxe: deluxe!,
      flexible: flexible!,
      nonRefundable: nonRefundable!,
    }
  }

  async function partnerSession(email: string, orgId: string, role: "admin" | "manager" | "staff") {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "P", lastName: "M" })
      .expect(201)

    // Signup no longer hands back a session (rule #58): a cookie for a new
    // account and none for an existing one would be the same leak restated.
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, res.body.user.id))
    await db.insert(partnerMembers).values({ orgId, userId: res.body.user.id, role, status: "active" })
    return res.headers["set-cookie"] as unknown as string[]
  }

  const availability = (from: number, to: number, extra = "") =>
    request(server()).get(
      `/api/v1/properties/the-ritz-carlton/availability?checkIn=${iso(from)}&checkOut=${iso(to)}${extra}`
    )

  beforeEach(async () => {
    await cleanup()
    fx = await seed()
  })

  /* ------------------------------------------------------------ resolution */

  it("prices from the plan defaults when the calendar is empty", async () => {
    // Both calendars are sparse — a stay with no override rows still resolves.
    const res = await availability(10, 13).expect(200)

    expect(res.body.nights).toBe(3)
    const room = res.body.rooms[0]
    expect(room.unitsLeft).toBe(3)

    const flexible = room.ratePlans.find((p: { ratePlanName: string }) => p.ratePlanName === "Flexible")
    expect(flexible.nightlyRates).toEqual([72_500, 72_500, 72_500])
    expect(flexible.totalRate).toBe(217_500)
    expect(flexible.available).toBe(true)
  })

  it("prices two plans differently off the SAME stock", async () => {
    const res = await availability(10, 13).expect(200)
    const room = res.body.rooms[0]
    const [flexible, nonRefundable] = ["Flexible", "Non-refundable"].map((n) =>
      room.ratePlans.find((p: { ratePlanName: string }) => p.ratePlanName === n)
    )

    expect(flexible.totalRate).toBe(217_500)
    expect(nonRefundable.totalRate).toBe(186_000)
    // One room, one counter — the plans cannot oversell each other.
    expect(room.unitsLeft).toBe(3)
  })

  it("applies a per-date rate override to that night only", async () => {
    await db.insert(ratePlanRates).values({
      ratePlanId: fx.flexible.id,
      date: iso(11),
      rate: 140_000,
    })

    const res = await availability(10, 13).expect(200)
    const flexible = res.body.rooms[0].ratePlans.find(
      (p: { ratePlanName: string }) => p.ratePlanName === "Flexible"
    )
    expect(flexible.nightlyRates).toEqual([72_500, 140_000, 72_500])
    expect(flexible.totalRate).toBe(285_000)
    // The other plan is untouched — rates belong to the plan, not the room.
    const nonRefundable = res.body.rooms[0].ratePlans.find(
      (p: { ratePlanName: string }) => p.ratePlanName === "Non-refundable"
    )
    expect(nonRefundable.nightlyRates).toEqual([62_000, 62_000, 62_000])
  })

  it("counts booked units against the tightest night", async () => {
    await db.insert(roomInventory).values([
      { roomId: fx.deluxe.id, date: iso(10), totalUnits: 3, sellableUnits: 3, bookedUnits: 1 },
      { roomId: fx.deluxe.id, date: iso(11), totalUnits: 3, sellableUnits: 3, bookedUnits: 3 },
    ])

    const res = await availability(10, 13).expect(200)
    // One full night blocks the whole stay.
    expect(res.body.rooms[0].unitsLeft).toBe(0)
    expect(res.body.available).toBe(false)
    expect(res.body.rooms[0].ratePlans[0].reason).toBe("sold_out")
  })

  /* ---------------------------------------------------------- restrictions */

  it("blocks a stay beginning on a closed-to-arrival date (rule #33)", async () => {
    await db.insert(ratePlanRates).values({
      ratePlanId: fx.flexible.id,
      date: iso(10),
      closedToArrival: true,
    })

    const res = await availability(10, 13).expect(200)
    const flexible = res.body.rooms[0].ratePlans.find(
      (p: { ratePlanName: string }) => p.ratePlanName === "Flexible"
    )
    expect(flexible.available).toBe(false)
    expect(flexible.reason).toBe("closed_to_arrival")
    // The restriction is the PLAN's — the other plan is still bookable.
    const nonRefundable = res.body.rooms[0].ratePlans.find(
      (p: { ratePlanName: string }) => p.ratePlanName === "Non-refundable"
    )
    expect(nonRefundable.available).toBe(true)
  })

  it("blocks a stay ending on a closed-to-departure date", async () => {
    // CTD sits on the CHECKOUT date, which is not a night of the stay — the
    // service loads one day past checkout precisely so this is seen at all.
    await db.insert(ratePlanRates).values({
      ratePlanId: fx.flexible.id,
      date: iso(13),
      closedToDeparture: true,
    })

    const res = await availability(10, 13).expect(200)
    const flexible = res.body.rooms[0].ratePlans.find(
      (p: { ratePlanName: string }) => p.ratePlanName === "Flexible"
    )
    expect(flexible.reason).toBe("closed_to_departure")
  })

  it("enforces a per-date minimum stay", async () => {
    await db.insert(ratePlanRates).values({
      ratePlanId: fx.flexible.id,
      date: iso(10),
      minStay: 5,
    })

    const short = await availability(10, 13).expect(200)
    expect(
      short.body.rooms[0].ratePlans.find((p: { ratePlanName: string }) => p.ratePlanName === "Flexible")
        .reason
    ).toBe("min_stay")

    const long = await availability(10, 15).expect(200)
    expect(
      long.body.rooms[0].ratePlans.find((p: { ratePlanName: string }) => p.ratePlanName === "Flexible")
        .available
    ).toBe(true)
  })

  it("closes the weekend bypass with min_stay_through (rule #26)", async () => {
    // Arrival night allows 1; a night INSIDE the stay demands 3.
    await db.insert(ratePlanRates).values({
      ratePlanId: fx.flexible.id,
      date: iso(11),
      minStayThrough: 3,
    })

    const res = await availability(10, 12).expect(200)
    expect(
      res.body.rooms[0].ratePlans.find((p: { ratePlanName: string }) => p.ratePlanName === "Flexible")
        .reason
    ).toBe("min_stay_through")
  })

  /* -------------------------------------------------------------- guards -- */

  it("rejects a stay beyond the booking horizon (rule #34)", async () => {
    await availability(600, 603).expect(400)
  })

  it("rejects check-in in the past", async () => {
    await availability(-5, 1).expect(400)
  })

  it("rejects check-out on or before check-in", async () => {
    await availability(10, 10).expect(400)
  })

  it("rejects an unbounded stay length (API4)", async () => {
    await availability(10, 200).expect(400)
  })

  it("rejects occupancy that no room can take", async () => {
    const res = await availability(10, 13, "&adults=6").expect(200)
    expect(res.body.available).toBe(false)
    expect(res.body.rooms[0].ratePlans[0].reason).toBe("capacity")
  })

  /* --------------------------------------------------------- partner write */

  it("closes every room of a property in one call (rule #32)", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")

    const res = await request(server())
      .post("/api/v1/partner/inventory/close")
      .set("Cookie", cookie)
      .send({ propertyId: fx.ritz.id, from: iso(10), to: iso(12), isClosed: true })
      .expect(201)

    expect(res.body).toMatchObject({ rooms: 1, datesAffected: 3 })

    const after = await availability(10, 13).expect(200)
    expect(after.body.available).toBe(false)
    expect(after.body.rooms[0].ratePlans[0].reason).toBe("closed")
  })

  it("reopens what it closed", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    const range = { propertyId: fx.ritz.id, from: iso(10), to: iso(12) }

    await request(server())
      .post("/api/v1/partner/inventory/close")
      .set("Cookie", cookie)
      .send({ ...range, isClosed: true })
      .expect(201)
    await request(server())
      .post("/api/v1/partner/inventory/close")
      .set("Cookie", cookie)
      .send({ ...range, isClosed: false })
      .expect(201)

    expect((await availability(10, 13).expect(200)).body.available).toBe(true)
  })

  it("seeds units from the room, so the overbooking CHECK has something to guard", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    await request(server())
      .post("/api/v1/partner/inventory/close")
      .set("Cookie", cookie)
      .send({ propertyId: fx.ritz.id, from: iso(10), to: iso(10), isClosed: false })
      .expect(201)

    const [row] = await db
      .select()
      .from(roomInventory)
      .where(eq(roomInventory.roomId, fx.deluxe.id))
    expect(row).toMatchObject({ totalUnits: 3, sellableUnits: 3, bookedUnits: 0 })
  })

  it("sets rates across a range", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")

    await request(server())
      .post("/api/v1/partner/inventory/rates")
      .set("Cookie", cookie)
      .send({ ratePlanId: fx.flexible.id, from: iso(10), to: iso(12), rate: 90_000, minStay: 2 })
      .expect(201)

    const res = await availability(10, 13).expect(200)
    const flexible = res.body.rooms[0].ratePlans.find(
      (p: { ratePlanName: string }) => p.ratePlanName === "Flexible"
    )
    expect(flexible.nightlyRates).toEqual([90_000, 90_000, 90_000])
  })

  it("404s another org's property on a bulk close (API1)", async () => {
    const cookie = await partnerSession("rival@rival.test", fx.rival.id, "admin")
    await request(server())
      .post("/api/v1/partner/inventory/close")
      .set("Cookie", cookie)
      .send({ propertyId: fx.ritz.id, from: iso(10), to: iso(12), isClosed: true })
      .expect(404)

    // ...and nothing was closed.
    expect((await availability(10, 13).expect(200)).body.available).toBe(true)
  })

  it("404s another org's rate plan (API1)", async () => {
    const cookie = await partnerSession("rival@rival.test", fx.rival.id, "admin")
    await request(server())
      .post("/api/v1/partner/inventory/rates")
      .set("Cookie", cookie)
      .send({ ratePlanId: fx.flexible.id, from: iso(10), to: iso(12), rate: 1 })
      .expect(404)
  })

  it("refuses staff on availability changes (rule #14)", async () => {
    const cookie = await partnerSession("desk@aurora.test", fx.aurora.id, "staff")
    await request(server())
      .post("/api/v1/partner/inventory/close")
      .set("Cookie", cookie)
      .send({ propertyId: fx.ritz.id, from: iso(10), to: iso(12), isClosed: true })
      .expect(403)
  })

  it("refuses an unbounded close range (API4)", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    await request(server())
      .post("/api/v1/partner/inventory/close")
      .set("Cookie", cookie)
      .send({ propertyId: fx.ritz.id, from: iso(1), to: iso(900), isClosed: true })
      .expect(400)
  })

  it("refuses a rate range that ends before it starts", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    await request(server())
      .post("/api/v1/partner/inventory/rates")
      .set("Cookie", cookie)
      .send({ ratePlanId: fx.flexible.id, from: iso(12), to: iso(10), rate: 1000 })
      .expect(400)
  })

  /* ---------------------------------------- the calendar, read back (3.1) */

  const calendar = (cookie: string[], query = `from=${iso(10)}&to=${iso(12)}`) =>
    request(server())
      .get(`/api/v1/partner/inventory/calendar/${fx.ritz.id}?${query}`)
      .set("Cookie", cookie)

  /*
   * Omitted and `null` mean different things, and used to mean the same one.
   *
   * `ON CONFLICT DO UPDATE SET rate = COALESCE(EXCLUDED.rate, rate)` keeps the
   * old value whether a field was left out or explicitly cleared — so nothing
   * once set could ever be unset. A price typed by mistake stayed forever, and
   * a minimum stay set in error kept refusing bookings with no way back.
   */
  it("clears a rate with null, and leaves an omitted field alone", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    const night = () =>
      calendar(cookie, `from=${iso(10)}&to=${iso(10)}`)
        .expect(200)
        .then((r) => {
          const room = r.body.rooms.find((x: { id: string }) => x.id === fx.deluxe.id)
          return room.ratePlans.find((p: { id: string }) => p.id === fx.flexible.id).nights[0]
        })

    const set = (body: Record<string, unknown>) =>
      request(server())
        .post("/api/v1/partner/inventory/rates")
        .set("Cookie", cookie)
        .send({ ratePlanId: fx.flexible.id, from: iso(10), to: iso(10), ...body })
        .expect(201)

    const plan = fx.flexible.basePrice

    await set({ rate: 90_000, minStay: 3 })
    expect(await night()).toMatchObject({ rate: 90_000, minStay: 3, isOverridden: true })

    // Omitted: the rate is not mentioned, so the rate does not move.
    await set({ minStay: 5 })
    expect(await night()).toMatchObject({ rate: 90_000, minStay: 5 })

    // Explicit null: back to what the plan says, and only that field.
    await set({ minStay: null })
    expect(await night()).toMatchObject({ rate: 90_000, minStay: 1 })

    await set({ rate: null })
    /*
     * And the badge goes with it.
     *
     * `isOverridden` asks whether this night has its OWN price. Clearing one
     * leaves the row behind — it still holds the night's restrictions — so a
     * row-level test kept claiming an override against the plan's own number.
     */
    expect(await night()).toMatchObject({ rate: plan, isOverridden: false })
  })

  it("reads back a calendar that could only be written before", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    const res = await calendar(cookie).expect(200)

    expect(res.body.from).toBe(iso(10))
    const room = res.body.rooms.find((r: { id: string }) => r.id === fx.deluxe.id)
    expect(room.stock).toHaveLength(3)
    expect(room.ratePlans.length).toBeGreaterThan(0)
    expect(room.ratePlans[0].nights).toHaveLength(3)
  })

  it("fills the nights nobody has touched with the defaults", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    const res = await calendar(cookie).expect(200)

    const room = res.body.rooms.find((r: { id: string }) => r.id === fx.deluxe.id)
    const plan = room.ratePlans.find((p: { id: string }) => p.id === fx.flexible.id)

    /*
     * The calendar is sparse, so most nights have no row at all. Returning the
     * raw rows would show a partner blanks and leave them unable to tell an
     * empty night from an unloaded one.
     */
    expect(plan.nights.every((n: { isOverridden: boolean }) => n.isOverridden === false)).toBe(true)
    expect(plan.nights[0].rate).toBe(plan.basePrice)
    expect(room.stock.every((s: { isMaterialised: boolean }) => s.isMaterialised === false)).toBe(true)
    expect(room.stock[0].sellableUnits).toBe(room.units)
  })

  it("marks the nights a partner actually set", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")

    await request(server())
      .post("/api/v1/partner/inventory/rates")
      .set("Cookie", cookie)
      .send({
        ratePlanId: fx.flexible.id,
        from: iso(10),
        to: iso(10),
        rate: 99_000,
        minStay: 3,
      })
      .expect(201)

    const res = await calendar(cookie).expect(200)
    const plan = res.body.rooms
      .find((r: { id: string }) => r.id === fx.deluxe.id)
      .ratePlans.find((p: { id: string }) => p.id === fx.flexible.id)

    // Every screen that shows an override badge needs exactly this difference.
    expect(plan.nights[0]).toMatchObject({ rate: 99_000, minStay: 3, isOverridden: true })
    expect(plan.nights[1]).toMatchObject({ rate: plan.basePrice, isOverridden: false })
  })

  it("shows what the guest would actually be charged", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")

    await request(server())
      .post("/api/v1/partner/inventory/rates")
      .set("Cookie", cookie)
      .send({ ratePlanId: fx.flexible.id, from: iso(10), to: iso(11), rate: 88_000 })
      .expect(201)

    const partnerView = await calendar(cookie).expect(200)
    const partnerRate = partnerView.body.rooms
      .find((r: { id: string }) => r.id === fx.deluxe.id)
      .ratePlans.find((p: { id: string }) => p.id === fx.flexible.id).nights[0].rate

    const guestView = await request(server())
      .get(`/api/v1/properties/the-ritz-carlton/availability?checkIn=${iso(10)}&checkOut=${iso(11)}`)
      .expect(200)
    const guestRoom = guestView.body.rooms.find((r: { roomId: string }) => r.roomId === fx.deluxe.id)
    // Found by id: the guest's plans are ordered by price, so `[0]` is
    // whichever is cheapest that day, not the one this test overrode.
    const guestPlan = guestRoom.ratePlans.find(
      (p: { ratePlanId: string }) => p.ratePlanId === fx.flexible.id
    )

    /*
     * Both sides run the same `resolveNight`. If they ever diverged, a partner
     * would set one price and a guest would be quoted another — and neither
     * screen would be obviously wrong.
     */
    expect(partnerRate).toBe(88_000)
    expect(guestPlan.nightlyRates[0]).toBe(88_000)
  })

  it("shows a closure and what is already sold", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    await db.insert(roomInventory).values({
      roomId: fx.deluxe.id,
      date: iso(11),
      totalUnits: 3,
      sellableUnits: 3,
      bookedUnits: 2,
      isClosed: true,
    })

    const res = await calendar(cookie).expect(200)
    const stock = res.body.rooms.find((r: { id: string }) => r.id === fx.deluxe.id).stock

    expect(stock[1]).toMatchObject({
      bookedUnits: 2,
      isClosed: true,
      isMaterialised: true,
    })
  })

  it("narrows to one room and one rate plan when asked", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    const res = await calendar(
      cookie,
      `from=${iso(10)}&to=${iso(11)}&roomId=${fx.deluxe.id}&ratePlanId=${fx.flexible.id}`
    ).expect(200)

    expect(res.body.rooms).toHaveLength(1)
    expect(res.body.rooms[0].ratePlans).toHaveLength(1)
    expect(res.body.rooms[0].ratePlans[0].id).toBe(fx.flexible.id)
  })

  it("lets front-desk staff read it", async () => {
    // Changing a rate is a commercial act; looking at tonight's stock is the
    // job. Locking it away only means a 2am phone call for a number on a screen.
    const desk = await partnerSession("desk@aurora.test", fx.aurora.id, "staff")
    await calendar(desk).expect(200)
  })

  it("refuses an anonymous caller and a guest (API5)", async () => {
    await request(server())
      .get(`/api/v1/partner/inventory/calendar/${fx.ritz.id}?from=${iso(10)}&to=${iso(12)}`)
      .expect(401)

    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email: "nobody@example.com", password: strong, firstName: "N", lastName: "B" })
      .expect(201)

    // Signup no longer hands back a session (rule #58).
    const plainGuest = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: "nobody@example.com", password: strong })
      .expect(200)
    await calendar(plainGuest.headers["set-cookie"] as unknown as string[]).expect(403)
  })

  it("404s a rival's calendar — never 403 (API1)", async () => {
    // A competitor's rates and occupancy are the two figures they would most
    // like to have.
    const outsider = await partnerSession("boss@rival.test", fx.rival.id, "admin")
    const res = await calendar(outsider).expect(404)
    expect(res.body.message).toBe("Property not found")
  })

  it("caps the range at a year (API4)", async () => {
    const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
    await calendar(cookie, `from=${iso(1)}&to=${iso(400)}`).expect(400)
    await calendar(cookie, `from=${iso(12)}&to=${iso(10)}`).expect(400)
  })

  /* ============================== copying a calendar (rule #100) == */

  describe("copying rates", () => {
    const setRates = (cookie: string[], body: Record<string, unknown>) =>
      request(server())
        .post("/api/v1/partner/inventory/rates")
        .set("Cookie", cookie)
        .send(body)

    const copy = (cookie: string[], body: Record<string, unknown>) =>
      request(server())
        .post("/api/v1/partner/inventory/rates/copy")
        .set("Cookie", cookie)
        .send(body)

    const ratesOn = async (ratePlanId: string) => {
      const rows = await db
        .select()
        .from(ratePlanRates)
        .where(eq(ratePlanRates.ratePlanId, ratePlanId))
        .orderBy(asc(ratePlanRates.date))
      return rows
    }

    it("copies a range onto another range of the same length", async () => {
      const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
      await setRates(cookie, {
        ratePlanId: fx.flexible.id,
        from: iso(10),
        to: iso(12),
        rate: 90_000,
        minStay: 2,
      }).expect(201)

      const res = await copy(cookie, {
        sourceRatePlanId: fx.flexible.id,
        sourceFrom: iso(10),
        sourceTo: iso(12),
        targetFrom: iso(20),
        targetTo: iso(22),
      }).expect(201)

      expect(res.body.datesAffected).toBe(3)
      const rows = await ratesOn(fx.flexible.id)
      const copied = rows.filter((r) => r.date >= iso(20) && r.date <= iso(22))
      expect(copied).toHaveLength(3)
      // The restrictions travel with the rate. A copy that moved only the
      // price would silently drop a two-night minimum.
      for (const row of copied) expect(row).toMatchObject({ rate: 90_000, minStay: 2 })
    })

    it("repeats a short source across a longer target", async () => {
      const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
      // Two days: one cheap, one dear.
      await setRates(cookie, {
        ratePlanId: fx.flexible.id,
        from: iso(10),
        to: iso(10),
        rate: 50_000,
      }).expect(201)
      await setRates(cookie, {
        ratePlanId: fx.flexible.id,
        from: iso(11),
        to: iso(11),
        rate: 80_000,
      }).expect(201)

      await copy(cookie, {
        sourceRatePlanId: fx.flexible.id,
        sourceFrom: iso(10),
        sourceTo: iso(11),
        targetFrom: iso(30),
        targetTo: iso(35),
      }).expect(201)

      const rows = await ratesOn(fx.flexible.id)
      const copied = rows.filter((r) => r.date >= iso(30) && r.date <= iso(35))
      expect(copied).toHaveLength(6)
      // Copying a typical week over a season is the reason the screen exists.
      expect(copied.map((r) => r.rate)).toEqual([
        50_000, 80_000, 50_000, 80_000, 50_000, 80_000,
      ])
    })

    it("leaves a target day alone when the source never set one", async () => {
      const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
      // Source has day 10 only; day 11 is untouched calendar.
      await setRates(cookie, {
        ratePlanId: fx.flexible.id,
        from: iso(10),
        to: iso(10),
        rate: 50_000,
      }).expect(201)
      // Target day 21 already carries a rate of its own.
      await setRates(cookie, {
        ratePlanId: fx.flexible.id,
        from: iso(21),
        to: iso(21),
        rate: 99_000,
      }).expect(201)

      await copy(cookie, {
        sourceRatePlanId: fx.flexible.id,
        sourceFrom: iso(10),
        sourceTo: iso(11),
        targetFrom: iso(20),
        targetTo: iso(21),
      }).expect(201)

      const rows = await ratesOn(fx.flexible.id)
      expect(rows.find((r) => r.date === iso(20))?.rate).toBe(50_000)
      /*
       * An empty source day means "fall back to the rate plan" (rule #23), not
       * "set nothing". Writing a row of NULLs would replace that fallback with
       * an explicit nothing and wipe the 99,000 that was already there.
       */
      expect(rows.find((r) => r.date === iso(21))?.rate).toBe(99_000)
    })

    it("copies between two rate plans", async () => {
      const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
      await setRates(cookie, {
        ratePlanId: fx.flexible.id,
        from: iso(10),
        to: iso(11),
        rate: 90_000,
      }).expect(201)

      await copy(cookie, {
        sourceRatePlanId: fx.flexible.id,
        targetRatePlanId: fx.nonRefundable.id,
        sourceFrom: iso(10),
        sourceTo: iso(11),
        targetFrom: iso(10),
        targetTo: iso(11),
      }).expect(201)

      const target = await ratesOn(fx.nonRefundable.id)
      expect(target).toHaveLength(2)
      expect(target.every((r) => r.rate === 90_000)).toBe(true)
    })

    it("refuses a rate plan the caller does not own - 404, not 403", async () => {
      const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")

      const [rivalProperty] = await db
        .insert(properties)
        .values({
          slug: "rival-hotel",
          name: "Rival Hotel",
          city: "New York",
          country: "USA",
          status: "active",
          basePrice: 40_000,
          partnerOrgId: fx.rival.id,
        })
        .returning()
      const [rivalRoom] = await db
        .insert(rooms)
        .values({
          propertyId: rivalProperty!.id,
          name: "Standard",
          maxAdults: 2,
          maxChildren: 0,
          maxOccupancy: 2,
          units: 2,
        })
        .returning()
      const [rivalPlan] = await db
        .insert(ratePlans)
        .values({
          roomId: rivalRoom!.id,
          name: "Flexible",
          basePrice: 40_000,
          cancelFreeUntil: "48h",
          cancelCharge: "full",
          isDefault: true,
        })
        .returning()

      // Reading someone else's calendar by copying FROM it is the same leak as
      // reading it directly.
      await copy(cookie, {
        sourceRatePlanId: rivalPlan!.id,
        targetRatePlanId: fx.flexible.id,
        sourceFrom: iso(10),
        sourceTo: iso(11),
        targetFrom: iso(20),
        targetTo: iso(21),
      }).expect(404)

      // And writing INTO it is worse.
      await copy(cookie, {
        sourceRatePlanId: fx.flexible.id,
        targetRatePlanId: rivalPlan!.id,
        sourceFrom: iso(10),
        sourceTo: iso(11),
        targetFrom: iso(20),
        targetTo: iso(21),
      }).expect(404)
    })

    it("refuses front-desk staff, like every other rate change (rule #66)", async () => {
      const cookie = await partnerSession("desk@aurora.test", fx.aurora.id, "staff")
      await copy(cookie, {
        sourceRatePlanId: fx.flexible.id,
        sourceFrom: iso(10),
        sourceTo: iso(11),
        targetFrom: iso(20),
        targetTo: iso(21),
      }).expect(403)
    })

    it("refuses a backwards range, a copy onto itself, and more than a year", async () => {
      const cookie = await partnerSession("sarah@aurora.test", fx.aurora.id, "admin")
      const base = {
        sourceRatePlanId: fx.flexible.id,
        sourceFrom: iso(10),
        sourceTo: iso(11),
      }

      await copy(cookie, { ...base, targetFrom: iso(21), targetTo: iso(20) }).expect(400)
      await copy(cookie, {
        ...base,
        sourceTo: iso(9),
        targetFrom: iso(20),
        targetTo: iso(21),
      }).expect(400)
      // The same plan, the same days: reads every row and writes it back over
      // itself, then reports a number of changed days that changed nothing.
      await copy(cookie, { ...base, targetFrom: iso(10), targetTo: iso(11) }).expect(400)
      await copy(cookie, { ...base, targetFrom: iso(20), targetTo: iso(400) }).expect(400)
    })

    it("needs a session", async () => {
      await request(server())
        .post("/api/v1/partner/inventory/rates/copy")
        .send({
          sourceRatePlanId: fx.flexible.id,
          sourceFrom: iso(10),
          sourceTo: iso(11),
          targetFrom: iso(20),
          targetTo: iso(21),
        })
        .expect(401)
    })
  })
})
