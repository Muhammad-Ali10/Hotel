import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { and, eq, sql } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { resetDb } from "./support/reset-db"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import { signWebhook } from "../src/modules/payments/provider/fake.provider"
import {
  bookingNights,
  bookings,
  partnerMembers,
  partnerOrgs,
  payments,
  properties,
  ratePlans,
  reviews,
  roomInventory,
  rooms,
  searchEvents,
  searchImpressions,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"

/** An ISO date `offset` days from today. */
const iso = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

describe("analytics", () => {
  let app: NestExpressApplication
  let db: Database
  let n = 0

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
    await app.listen(0)
    db = moduleRef.get<Database>(DRIZZLE)
  })

  afterAll(async () => {
    await resetDb(db)
    await app?.close()
  })

  const server = () => app.getHttpServer()
  const freshIp = () => `198.51.100.${++n % 250}`

  /* ------------------------------------------------------------- fixtures -- */

  type Fixture = Awaited<ReturnType<typeof seed>>
  let fx: Fixture

  async function seed() {
    const [org] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora Hospitality", contactEmail: "hello@aurora.test", status: "active" })
      .returning()

    const [ritz] = await db
      .insert(properties)
      .values({
        slug: "the-ritz-carlton",
        name: "The Ritz-Carlton",
        city: "New York",
        country: "USA",
        type: "hotel",
        stars: 5,
        // UTC on purpose: every assertion below about which DAY a booking
        // lands in would otherwise depend on the hour the suite happens to run.
        timezone: "UTC",
        checkInTime: "15:00",
        status: "active",
        basePrice: 72_500,
        partnerOrgId: org!.id,
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
        units: 10,
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

    return { org: org!, ritz: ritz!, deluxe: deluxe!, flexible: flexible! }
  }

  async function guest(email = `g${++n}@example.com`) {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "John", lastName: "Doe" })
      .expect(201)

    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)

    return {
      cookie: res.headers["set-cookie"] as unknown as string[],
      id: res.body.user.id as string,
      email,
    }
  }

  async function partner(role: "admin" | "manager" | "staff", propertyIds: string[] = []) {
    const g = await guest(`p${++n}@aurora.test`)
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, g.id))
    await db
      .insert(partnerMembers)
      .values({ orgId: fx.org.id, userId: g.id, role, status: "active", propertyIds })
      .returning()

    // Re-sign-in so the session carries the membership.
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: g.email, password: strong })
      .expect(200)
    return res.headers["set-cookie"] as unknown as string[]
  }

  /** A confirmed booking, made the only way the product allows. */
  const bookAndPay = async (over: Record<string, unknown> = {}) => {
    const g = await guest()
    const quote = await request(server())
      .post("/api/v1/properties/the-ritz-carlton/quote")
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({
        roomId: fx.deluxe.id,
        ratePlanId: fx.flexible.id,
        checkIn: iso(10),
        checkOut: iso(13),
        adults: 2,
        ...over,
      })
      .expect(201)

    const created = await request(server())
      .post("/api/v1/bookings")
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .set("Idempotency-Key", `idem-key-${++n}-${Date.now()}`)
      .send({
        quoteToken: quote.body.quoteToken,
        guest: { firstName: "John", lastName: "Doe", email: "john@example.com" },
      })
      .expect(201)

    const bookingId = created.body.booking.id as string

    await request(server())
      .post("/api/v1/payments/start")
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ bookingId })
      .expect(201)

    const [payment] = await db.select().from(payments).where(eq(payments.bookingId, bookingId))
    const body = JSON.stringify({
      id: `evt_${payment!.id}`,
      type: "payment.captured",
      providerRef: payment!.providerRef,
      amount: payment!.amount,
      currency: "USD",
      cardBrand: "visa",
      cardLast4: "4242",
    })
    await request(server())
      .post("/api/v1/payments/webhook")
      .set("x-payment-signature", signWebhook(Buffer.from(body, "utf8")))
      .set("Content-Type", "application/json")
      .send(body)
      .expect(201)

    return { bookingId, cookie: g.cookie, guestId: g.id }
  }

  /**
   * A confirmed booking written straight to the tables.
   *
   * Used where the point is the READ side — the aggregates need known numbers
   * on known dates, and driving twenty of them through quote/book/pay would
   * turn a query test into a two-minute integration run. The write path has
   * its own tests above, against real bookings.
   */
  const seedBooking = async (over: {
    checkIn: string
    checkOut: string
    rates: number[]
    propertyId?: string
    roomId?: string
    ratePlanId?: string
    status?: string
    total?: number
  }) => {
    const subtotal = over.rates.reduce((a, b) => a + b, 0)
    const propertyId = over.propertyId ?? fx.ritz.id
    const roomId = over.roomId ?? fx.deluxe.id
    const ratePlanId = over.ratePlanId ?? fx.flexible.id

    const [booking] = await db
      .insert(bookings)
      .values({
        ref: `STY-${++n}-${Date.now() % 100000}`,
        propertyId,
        roomId,
        ratePlanId,
        propertyName: "The Ritz-Carlton",
        roomName: "Deluxe King Room",
        ratePlanName: "Flexible",
        city: "New York",
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        guestFirstName: "A",
        guestLastName: "B",
        guestEmail: `a${n}@b.test`,
        guestCountry: "USA",
        checkIn: over.checkIn,
        checkOut: over.checkOut,
        adults: 2,
        children: 0,
        pricing: {
          nights: over.rates.length,
          nightlyRates: over.rates,
          ratePerNight: Math.round(subtotal / over.rates.length),
          roomSubtotal: subtotal,
          addOnsTotal: 0,
          total: over.total ?? subtotal,
        },
        total: over.total ?? subtotal,
        paymentMode: "prepay",
        commissionRateBps: 1500,
        commissionAmount: Math.round((over.total ?? subtotal) * 0.15),
        status: over.status ?? "confirmed",
        /*
         * `bookings_cancellation_consistency` requires both of these whenever
         * the status is `cancelled` — the schema refuses a cancellation that
         * cannot say when it happened or who did it.
         */
        ...(over.status === "cancelled"
          ? { cancelledAt: new Date().toISOString(), cancelledBy: "guest" as const }
          : {}),
      })
      .returning()

    const dates = over.rates.map((_, i) => {
      const d = new Date(`${over.checkIn}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + i)
      return d.toISOString().slice(0, 10)
    })

    await db.insert(bookingNights).values(
      dates.map((date, i) => ({
        bookingId: booking!.id,
        date,
        propertyId,
        roomId,
        ratePlanId,
        roomRevenue: over.rates[i]!,
      }))
    )

    return { bookingId: booking!.id, dates }
  }

  const get = (cookie: string[], path: string) =>
    request(server()).get(`/api/v1/partner/analytics/${path}`).set("Cookie", cookie)

  beforeEach(async () => {
    await resetDb(db)
    fx = await seed()
  })

  /* ================================================ the stay-date ledger == */

  describe("booking_nights — the stay-date ledger (rule #62)", () => {
    it("writes one row per night, never one for the departure day", async () => {
      const { bookingId } = await bookAndPay()

      const nights = await db
        .select()
        .from(bookingNights)
        .where(eq(bookingNights.bookingId, bookingId))
        .orderBy(bookingNights.date)

      // 10th to 13th is three nights: the guest leaves on the 13th.
      expect(nights.map((r) => r.date)).toEqual([iso(10), iso(11), iso(12)])
    })

    it("splits the room revenue so the parts add to exactly the whole", async () => {
      const { bookingId } = await bookAndPay()

      const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId))
      const pricing = booking!.pricing as { roomSubtotal: number; discount?: { amount: number } }
      const nights = await db
        .select()
        .from(bookingNights)
        .where(eq(bookingNights.bookingId, bookingId))

      const summed = nights.reduce((total, row) => total + row.roomRevenue, 0)
      expect(summed).toBe(pricing.roomSubtotal - (pricing.discount?.amount ?? 0))
    })

    /*
     * The reason the ledger carries no `status` of its own. A cancelled
     * booking's nights stay on the table; every query joins `bookings` for the
     * status, so a copy here would be a second truth going quietly stale.
     */
    it("keeps a cancelled booking's nights but stops counting them", async () => {
      const { bookingId, cookie } = await bookAndPay()
      const manager = await partner("manager")

      const before = await get(manager, `performance?from=${iso(10)}&to=${iso(12)}`).expect(200)
      expect(before.body[0].roomNights).toBe(3)

      await request(server())
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set("Cookie", cookie)
        .set("x-forwarded-for", freshIp())
        .send({ reason: "Plans changed" })
        .expect(201)

      const rows = await db
        .select()
        .from(bookingNights)
        .where(eq(bookingNights.bookingId, bookingId))
      expect(rows).toHaveLength(3)

      const after = await get(manager, `performance?from=${iso(10)}&to=${iso(12)}`).expect(200)
      expect(after.body[0].roomNights).toBe(0)
    })

    it("moves the nights when the stay moves, leaving nothing behind", async () => {
      const { bookingId, cookie } = await bookAndPay()

      // A modification is a re-quote, not a patch — the price has to be
      // recalculated for the new dates before anything moves.
      const requote = await request(server())
        .post("/api/v1/properties/the-ritz-carlton/quote")
        .set("Cookie", cookie)
        .set("x-forwarded-for", freshIp())
        .send({
          roomId: fx.deluxe.id,
          ratePlanId: fx.flexible.id,
          checkIn: iso(20),
          checkOut: iso(22),
          adults: 2,
        })
        .expect(201)

      await request(server())
        .post(`/api/v1/bookings/${bookingId}/modify`)
        .set("Cookie", cookie)
        .set("x-forwarded-for", freshIp())
        .send({ quoteToken: requote.body.quoteToken })
        .expect(201)

      const nights = await db
        .select()
        .from(bookingNights)
        .where(eq(bookingNights.bookingId, bookingId))
        .orderBy(bookingNights.date)

      expect(nights.map((r) => r.date)).toEqual([iso(20), iso(21)])
    })

    /*
     * The ledger must not outlive the booking it describes. Seeded directly
     * rather than booked: a real booking has payments and events pointing at
     * it, and those FKs are deliberately RESTRICT — deleting a booking that
     * took money is not something this product should make easy.
     */
    it("takes the nights with it when the booking is deleted", async () => {
      const { bookingId } = await seedBooking({ checkIn: iso(40), checkOut: iso(41), rates: [30_000] })
      await db.delete(bookings).where(eq(bookings.id, bookingId))

      const rows = await db
        .select()
        .from(bookingNights)
        .where(eq(bookingNights.bookingId, bookingId))
      expect(rows).toHaveLength(0)
    })
  })

  /* ============================================== who may see what (#66) == */

  describe("role and scope (rules #66, API1, API5)", () => {
    it("shows an org admin the money", async () => {
      await bookAndPay()
      const admin = await partner("admin")

      const res = await get(admin, `sales?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      expect(res.body.totals.revenue).toBeGreaterThan(0)
      expect(res.body.totals.commission).toBeGreaterThan(0)
    })

    it("shows a manager the money", async () => {
      await bookAndPay()
      const manager = await partner("manager")

      const res = await get(manager, `sales?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      expect(res.body.totals.revenue).toBeGreaterThan(0)
    })

    /*
     * `null`, not `0`. Zero is a claim about the business — "you earned
     * nothing" — and a front desk quietly reading that is worse than a screen
     * that says nothing.
     */
    it("gives staff the counts but null for every figure of money", async () => {
      await bookAndPay()
      const staff = await partner("staff")

      const res = await get(staff, `sales?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      expect(res.body.totals.bookings).toBe(1)
      expect(res.body.totals.revenue).toBeNull()
      expect(res.body.totals.commission).toBeNull()
      expect(res.body.totals.fees).toBeNull()
      for (const point of res.body.points) expect(point.revenue).toBeNull()
    })

    it("keeps ADR and RevPAR from staff too — they are money", async () => {
      await bookAndPay()
      const staff = await partner("staff")

      const res = await get(staff, `performance?from=${iso(10)}&to=${iso(12)}`).expect(200)
      expect(res.body[0].adr).toBeNull()
      expect(res.body[0].revpar).toBeNull()
      expect(res.body[0].revenue).toBeNull()
      // But the operational half is exactly what a front desk needs.
      expect(res.body[0].roomNights).toBe(3)
      expect(res.body[0].occupancy).toBeGreaterThan(0)
    })

    it("404s a property in another org — never 403 (API1)", async () => {
      const [other] = await db
        .insert(partnerOrgs)
        .values({ name: "Rival Group", contactEmail: "x@rival.test" })
        .returning()
      const [rival] = await db
        .insert(properties)
        .values({
          slug: "rival-hotel",
          name: "Rival Hotel",
          city: "New York",
          country: "USA",
          type: "hotel",
          stars: 4,
          timezone: "UTC",
          checkInTime: "15:00",
          status: "active",
          basePrice: 50_000,
          partnerOrgId: other!.id,
        })
        .returning()

      const admin = await partner("admin")
      await get(admin, `performance?from=${iso(0)}&to=${iso(1)}&propertyId=${rival!.id}`).expect(404)
    })

    it("honours a member scoped to a property that is not this one", async () => {
      await bookAndPay()
      const [second] = await db
        .insert(properties)
        .values({
          slug: "aurora-two",
          name: "Aurora Two",
          city: "Boston",
          country: "USA",
          type: "hotel",
          stars: 4,
          timezone: "UTC",
          checkInTime: "15:00",
          status: "active",
          basePrice: 40_000,
          partnerOrgId: fx.org.id,
        })
        .returning()

      const limited = await partner("manager", [second!.id])
      const res = await get(limited, `performance?from=${iso(10)}&to=${iso(12)}`).expect(200)

      // Only the property they were given, and none of the other's nights.
      expect(res.body).toHaveLength(1)
      expect(res.body[0].propertyId).toBe(second!.id)
      expect(res.body[0].roomNights).toBe(0)
    })

    it("turns a scoped member away from a property they were not given", async () => {
      const limited = await partner("manager", [fx.ritz.id])
      const [second] = await db
        .insert(properties)
        .values({
          slug: "aurora-three",
          name: "Aurora Three",
          city: "Boston",
          country: "USA",
          type: "hotel",
          stars: 4,
          timezone: "UTC",
          checkInTime: "15:00",
          status: "active",
          basePrice: 40_000,
          partnerOrgId: fx.org.id,
        })
        .returning()

      await get(limited, `performance?from=${iso(0)}&to=${iso(1)}&propertyId=${second!.id}`).expect(404)
    })

    it("refuses a guest outright", async () => {
      const g = await guest()
      await get(g.cookie, `sales?from=${iso(0)}&to=${iso(1)}`).expect(403)
    })

    it("refuses an anonymous caller", async () => {
      await request(server())
        .get(`/api/v1/partner/analytics/sales?from=${iso(0)}&to=${iso(1)}`)
        .expect(401)
    })
  })

  /* ================================================= input limits (API4) == */

  describe("the range (API4)", () => {
    it("refuses a range longer than two years", async () => {
      const admin = await partner("admin")
      await get(admin, `sales?from=2024-01-01&to=2026-12-31`).expect(400)
    })

    it("refuses a range that runs backwards", async () => {
      const admin = await partner("admin")
      await get(admin, `sales?from=${iso(10)}&to=${iso(1)}`).expect(400)
    })

    it("refuses an unknown query parameter rather than ignoring it (API3)", async () => {
      const admin = await partner("admin")
      await get(admin, `sales?from=${iso(0)}&to=${iso(1)}&orgId=whatever`).expect(400)
    })

    it("refuses a granularity outside the three it offers", async () => {
      const admin = await partner("admin")
      await get(admin, `sales?from=${iso(0)}&to=${iso(1)}&granularity=century`).expect(400)
    })

    it("accepts exactly two years", async () => {
      const admin = await partner("admin")
      await get(admin, `sales?from=2025-01-01&to=2027-01-01`).expect(200)
    })
  })

  /* ==================================================== the numbers (#63) == */

  describe("which bookings count (rule #63)", () => {
    it("never counts a pending hold as revenue", async () => {
      const g = await guest()
      const quote = await request(server())
        .post("/api/v1/properties/the-ritz-carlton/quote")
        .set("Cookie", g.cookie)
        .set("x-forwarded-for", freshIp())
        .send({ roomId: fx.deluxe.id, ratePlanId: fx.flexible.id, checkIn: iso(10), checkOut: iso(13), adults: 2 })
        .expect(201)

      // Created, never paid — a fifteen-minute hold and nothing more.
      await request(server())
        .post("/api/v1/bookings")
        .set("Cookie", g.cookie)
        .set("x-forwarded-for", freshIp())
        .set("Idempotency-Key", `idem-key-${++n}-${Date.now()}`)
        .send({ quoteToken: quote.body.quoteToken, guest: { firstName: "A", lastName: "B", email: "a@b.test" } })
        .expect(201)

      const admin = await partner("admin")
      const sales = await get(admin, `sales?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      expect(sales.body.totals.bookings).toBe(0)
      expect(sales.body.totals.revenue).toBe(0)

      const perf = await get(admin, `performance?from=${iso(10)}&to=${iso(12)}`).expect(200)
      expect(perf.body[0].roomNights).toBe(0)
    })

    it("counts a cancellation's penalty as revenue but not as a room-night", async () => {
      const { bookingId, cookie } = await bookAndPay()

      // Inside the 48h window would be free; this stay is ten days out, so
      // cancelling now costs nothing. Move it close to force the penalty.
      await db
        .update(bookings)
        .set({ checkIn: iso(0), checkOut: iso(2) })
        .where(eq(bookings.id, bookingId))

      await request(server())
        .post(`/api/v1/bookings/${bookingId}/cancel`)
        .set("Cookie", cookie)
        .set("x-forwarded-for", freshIp())
        .send({ reason: "Late change" })
        .expect(201)

      const admin = await partner("admin")
      const res = await get(admin, `sales?from=${iso(-1)}&to=${iso(1)}`).expect(200)

      // The stay itself no longer counts…
      expect(res.body.totals.bookings).toBe(0)
      expect(res.body.totals.cancelled).toBe(1)
      // …but the money that changed hands is reported on its own line.
      expect(res.body.totals.fees).toBeGreaterThan(0)
    })

    /*
     * The other half of rule #52, and the half that was silently broken. A
     * `guarantee` booking CHARGES the saved card, leaving a `penalty` payment;
     * a `prepay` one REFUNDS part of what it took, leaving none. Reading only
     * penalty rows reported zero for every prepaid cancellation — which is
     * most of them.
     */
    it("counts what a guaranteed booking charged, which leaves a penalty row", async () => {
      const { bookingId } = await seedBooking({
        checkIn: iso(1),
        checkOut: iso(3),
        rates: [30_000, 30_000],
        status: "cancelled",
      })
      await db
        .update(bookings)
        .set({ paymentMode: "guarantee", refundAmount: 0 })
        .where(eq(bookings.id, bookingId))
      await db.insert(payments).values({
        bookingId,
        kind: "penalty",
        mode: "guarantee",
        amount: 30_000,
        currency: "USD",
        status: "captured",
        // `payments_captured_consistency`: a settled payment must say when.
        capturedAt: new Date().toISOString(),
        provider: "fake",
        providerRef: `pen_${++n}`,
      })

      const admin = await partner("admin")
      const res = await get(admin, `sales?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      expect(res.body.totals.fees).toBe(30_000)
    })

    it("counts what a prepaid booking kept, where there is no penalty row at all", async () => {
      const { bookingId } = await seedBooking({
        checkIn: iso(1),
        checkOut: iso(3),
        rates: [30_000, 30_000],
        status: "cancelled",
      })
      // Paid $600 up front, given back $300 — the property kept $300.
      await db.update(bookings).set({ refundAmount: 30_000 }).where(eq(bookings.id, bookingId))
      await db.insert(payments).values({
        bookingId,
        kind: "charge",
        mode: "prepay",
        amount: 60_000,
        currency: "USD",
        status: "partially_refunded",
        capturedAt: new Date().toISOString(),
        provider: "fake",
        providerRef: `chg_${++n}`,
      })

      const admin = await partner("admin")
      const res = await get(admin, `sales?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      expect(res.body.totals.fees).toBe(30_000)
    })

    /*
     * Measured against what was CAPTURED, never against `bookings.total`. A
     * booking abandoned before payment would otherwise be reported as a fee
     * for the whole stay — money that never existed.
     */
    it("reports no fee at all when the guest was never charged", async () => {
      const { bookingId } = await seedBooking({
        checkIn: iso(1),
        checkOut: iso(3),
        rates: [30_000, 30_000],
        status: "cancelled",
      })
      await db.update(bookings).set({ refundAmount: 0 }).where(eq(bookings.id, bookingId))

      const admin = await partner("admin")
      const res = await get(admin, `sales?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      expect(res.body.totals.fees).toBe(0)
      expect(res.body.totals.cancelled).toBe(1)
    })
  })

  /* ======================================================== the metrics === */

  describe("ADR, occupancy and RevPAR", () => {
    /**
     * Loads a known calendar and a known set of nights, so the arithmetic can
     * be checked against numbers worked out by hand rather than against
     * whatever the code happened to produce.
     */
    const loadKnownMonth = async () => {
      const dates = [iso(40), iso(41), iso(42), iso(43)]

      // 10 sellable units on each of four nights = 40 available.
      await db.insert(roomInventory).values(
        dates.map((date) => ({
          roomId: fx.deluxe.id,
          date,
          totalUnits: 10,
          sellableUnits: 10,
          bookedUnits: 0,
        }))
      )

      // One booking, three nights at $300 each.
      const { bookingId } = await seedBooking({
        checkIn: dates[0]!,
        checkOut: dates[3]!,
        rates: [30_000, 30_000, 30_000],
      })

      return { dates, bookingId }
    }

    it("computes ADR from nights SOLD and RevPAR from nights AVAILABLE", async () => {
      const { dates } = await loadKnownMonth()
      const admin = await partner("admin")

      const res = await get(admin, `performance?from=${dates[0]}&to=${dates[3]}`).expect(200)
      const row = res.body[0]

      expect(row.roomNights).toBe(3)
      expect(row.roomNightsAvailable).toBe(40)
      expect(row.revenue).toBe(90_000)
      // $900 over 3 nights sold.
      expect(row.adr).toBe(30_000)
      // $900 over 40 nights available — the number ADR alone cannot tell you.
      expect(row.revpar).toBe(2_250)
      expect(row.occupancy).toBeCloseTo(3 / 40, 10)
    })

    /*
     * A room taken out of service was never on sale. Counting it would report
     * a property as emptier for doing sensible maintenance.
     */
    it("leaves closed nights out of the occupancy denominator", async () => {
      const { dates } = await loadKnownMonth()
      await db
        .update(roomInventory)
        .set({ isClosed: true })
        .where(and(eq(roomInventory.roomId, fx.deluxe.id), eq(roomInventory.date, dates[3]!)))

      const admin = await partner("admin")
      const res = await get(admin, `performance?from=${dates[0]}&to=${dates[3]}`).expect(200)

      expect(res.body[0].roomNightsAvailable).toBe(30)
      expect(res.body[0].occupancy).toBeCloseTo(3 / 30, 10)
    })

    it("gives a property with no bookings a row rather than dropping it", async () => {
      const admin = await partner("admin")
      const res = await get(admin, `performance?from=${iso(200)}&to=${iso(205)}`).expect(200)

      expect(res.body).toHaveLength(1)
      expect(res.body[0]).toMatchObject({ roomNights: 0, occupancy: 0, adr: 0 })
    })

    it("counts a night in the month it was STAYED, not the month it was booked", async () => {
      // A stay that straddles a boundary: two nights in one window, one in the next.
      const { dates } = await loadKnownMonth()
      const admin = await partner("admin")

      const first = await get(admin, `performance?from=${dates[0]}&to=${dates[1]}`).expect(200)
      expect(first.body[0].roomNights).toBe(2)

      const second = await get(admin, `performance?from=${dates[2]}&to=${dates[3]}`).expect(200)
      expect(second.body[0].roomNights).toBe(1)
    })

    it("averages published reviews on the product's 1–5 scale", async () => {
      const { bookingId } = await loadKnownMonth()
      const g = await guest()
      await db.insert(reviews).values([
        {
          propertyId: fx.ritz.id,
          bookingId,
          authorId: g.id,
          author: "John D.",
          rating: 5,
          categories: {},
          title: "Wonderful",
          body: "A really lovely stay from start to finish.",
          date: iso(43),
          status: "published",
        },
      ])

      const admin = await partner("admin")
      const res = await get(admin, `performance?from=${iso(40)}&to=${iso(43)}`).expect(200)
      expect(res.body[0].score).toBe(5)
      expect(res.body[0].reviews).toBe(1)
    })
  })

  /* ==================================================== the other screens == */

  describe("book window", () => {
    it("buckets a booking by how far ahead it was made", async () => {
      await bookAndPay()
      const admin = await partner("admin")

      const res = await get(admin, `book-window?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      const bucket = res.body.buckets.find((b: { key: string }) => b.key === "8_14")

      // Booked today for a stay ten days out.
      expect(bucket.bookings).toBe(1)
      expect(bucket.share).toBe(1)
      expect(res.body.medianLeadDays).toBe(10)
    })

    /*
     * The rate here is read from `booking_nights`, not recomputed from
     * `pricing`. Both would reach the same figure, which is exactly why only
     * one of them may exist — otherwise "net room revenue" is defined twice
     * and only one copy ever gets changed.
     */
    it("reads the bucket's rate from the ledger, the one place it is defined", async () => {
      // Booked today, staying in 40 days: three nights at $300.
      await seedBooking({ checkIn: iso(40), checkOut: iso(43), rates: [30_000, 30_000, 30_000] })
      const admin = await partner("admin")

      const res = await get(admin, `book-window?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      const bucket = res.body.buckets.find((b: { key: string }) => b.key === "31_60")

      expect(bucket.bookings).toBe(1)
      expect(bucket.avgRate).toBe(30_000)
    })

    it("returns every bucket even when empty, so the chart keeps its shape", async () => {
      const admin = await partner("admin")
      const res = await get(admin, `book-window?from=${iso(-1)}&to=${iso(1)}`).expect(200)

      expect(res.body.buckets).toHaveLength(7)
      expect(res.body.buckets.every((b: { bookings: number }) => b.bookings === 0)).toBe(true)
      expect(res.body.medianLeadDays).toBeNull()
    })
  })

  describe("cancellations", () => {
    it("reports the rate against every booking made in the range", async () => {
      const a = await bookAndPay()
      await bookAndPay()

      await request(server())
        .post(`/api/v1/bookings/${a.bookingId}/cancel`)
        .set("Cookie", a.cookie)
        .set("x-forwarded-for", freshIp())
        .send({ reason: "Plans changed" })
        .expect(201)

      const admin = await partner("admin")
      const res = await get(admin, `cancellations?from=${iso(-1)}&to=${iso(1)}`).expect(200)

      expect(res.body.total).toBe(1)
      expect(res.body.rate).toBeCloseTo(0.5, 10)
      expect(res.body.byReason[0]).toMatchObject({ reason: "Plans changed", count: 1 })
      expect(res.body.byActor[0]).toMatchObject({ actor: "guest", count: 1 })
    })

    it("measures notice from the cancellation to the CHECK-IN", async () => {
      const a = await bookAndPay()
      await request(server())
        .post(`/api/v1/bookings/${a.bookingId}/cancel`)
        .set("Cookie", a.cookie)
        .set("x-forwarded-for", freshIp())
        .send({ reason: "Plans changed" })
        .expect(201)

      const admin = await partner("admin")
      const res = await get(admin, `cancellations?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      // Cancelled today for a stay ten days out.
      expect(res.body.avgDaysBefore).toBe(10)
    })
  })

  describe("bookers", () => {
    it("segments by country, party and source", async () => {
      await bookAndPay()
      const admin = await partner("admin")

      const res = await get(admin, `bookers?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      expect(res.body.byParty[0]).toMatchObject({ segment: "Couple", bookings: 1, share: 1 })
      expect(res.body.bySource[0]).toMatchObject({ segment: "direct", bookings: 1 })
      expect(res.body.byCountry).toHaveLength(1)
    })

    it("hides average spend from staff but keeps the counts", async () => {
      await bookAndPay()
      const staff = await partner("staff")

      const res = await get(staff, `bookers?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      expect(res.body.byParty[0].bookings).toBe(1)
      expect(res.body.byParty[0].avgSpend).toBeNull()
    })
  })

  describe("genius", () => {
    it("reports nothing rather than dividing by zero on an empty range", async () => {
      const admin = await partner("admin")
      const res = await get(admin, `genius?from=${iso(-1)}&to=${iso(1)}`).expect(200)

      expect(res.body).toMatchObject({ bookings: 0, totalBookings: 0, share: 0 })
    })

    it("counts an ordinary booking against the non-Genius side", async () => {
      await bookAndPay()
      const admin = await partner("admin")

      const res = await get(admin, `genius?from=${iso(-1)}&to=${iso(1)}`).expect(200)
      expect(res.body.bookings).toBe(0)
      expect(res.body.totalBookings).toBe(1)
      expect(res.body.nonGeniusAdr).toBeGreaterThan(0)
    })
  })

  describe("pace", () => {
    it("splits nights already stayed from nights on the books", async () => {
      await bookAndPay()
      const admin = await partner("admin")

      const res = await get(admin, `pace?from=${iso(-5)}&to=${iso(20)}&granularity=month`).expect(200)
      const futureNights = res.body.future.reduce(
        (sum: number, row: { bookedNow: number }) => sum + row.bookedNow,
        0
      )
      expect(futureNights).toBe(3)
    })

    it("has nothing to compare against in a year with no history", async () => {
      await bookAndPay()
      const admin = await partner("admin")

      const res = await get(admin, `pace?from=${iso(0)}&to=${iso(20)}&granularity=month`).expect(200)
      for (const row of res.body.future) expect(row.lastYear).toBe(0)
    })
  })

  /* ================================================= comparables (#65) === */

  describe("comparables — anonymous, or nothing (rule #65)", () => {
    /** `count` rival properties in the same city, each having traded. */
    const rivals = async (count: number) => {
      for (let i = 0; i < count; i += 1) {
        const [org] = await db
          .insert(partnerOrgs)
          .values({ name: `Rival ${i}`, contactEmail: `r${i}@rival.test` })
          .returning()
        const [property] = await db
          .insert(properties)
          .values({
            slug: `rival-${i}-${n}`,
            name: `Rival ${i}`,
            city: "New York",
            country: "USA",
            type: "hotel",
            stars: 4,
            timezone: "UTC",
            checkInTime: "15:00",
            status: "active",
            basePrice: 50_000,
            partnerOrgId: org!.id,
          })
          .returning()
        const [room] = await db
          .insert(rooms)
          .values({
            propertyId: property!.id,
            name: "Room",
            maxAdults: 2,
            maxChildren: 0,
            maxOccupancy: 2,
            units: 5,
          })
          .returning()
        const [plan] = await db
          .insert(ratePlans)
          .values({
            roomId: room!.id,
            name: "Flexible",
            basePrice: 50_000,
            cancelFreeUntil: "48h",
            cancelCharge: "percent",
            cancelChargeValue: 50,
            isDefault: true,
          })
          .returning()

        await seedBooking({
          checkIn: iso(40),
          checkOut: iso(41),
          rates: [50_000],
          propertyId: property!.id,
          roomId: room!.id,
          ratePlanId: plan!.id,
        })
      }
    }

    /*
     * The whole protection. In a market of two, a partner who knows their own
     * ADR recovers the other's exactly: 2 × average − mine.
     */
    it("publishes nothing when too few properties trade in the city", async () => {
      await rivals(3)
      const admin = await partner("admin")

      const res = await get(
        admin,
        `comparables?from=${iso(40)}&to=${iso(41)}&propertyId=${fx.ritz.id}`
      ).expect(200)

      expect(res.body.suppressed).toBe(true)
      expect(res.body.market.adr).toBeNull()
      expect(res.body.versus.adr).toBeNull()
      // Not even the size of the market it refused to describe.
      expect(res.body.sample).toBe(0)
    })

    /*
     * The three market figures are drawn from different subsets — a property
     * can have inventory loaded without selling a night, and reviews without
     * either. Gating each on its own sample once let occupancy publish while
     * the rate stayed hidden, beside a response that said `suppressed: true`.
     */
    it("suppresses occupancy and score too, not just the rate", async () => {
      await rivals(3)
      const admin = await partner("admin")

      const res = await get(
        admin,
        `comparables?from=${iso(40)}&to=${iso(41)}&propertyId=${fx.ritz.id}`
      ).expect(200)

      expect(res.body.market).toEqual({ adr: null, occupancy: null, score: null })
      expect(res.body.versus).toEqual({ adr: null, occupancy: null, score: null })
    })

    it("publishes once the market is large enough to hide in", async () => {
      await rivals(5)
      const admin = await partner("admin")

      const res = await get(
        admin,
        `comparables?from=${iso(40)}&to=${iso(41)}&propertyId=${fx.ritz.id}`
      ).expect(200)

      expect(res.body.suppressed).toBe(false)
      expect(res.body.sample).toBe(5)
      expect(res.body.market.adr).toBe(50_000)
    })

    it("never names a competitor, whatever else it returns", async () => {
      await rivals(5)
      const admin = await partner("admin")

      const res = await get(
        admin,
        `comparables?from=${iso(40)}&to=${iso(41)}&propertyId=${fx.ritz.id}`
      ).expect(200)

      const body = JSON.stringify(res.body)
      expect(body).not.toContain("Rival")
      // No ids either — an id is a name one request away.
      expect(body).not.toMatch(/propertyId/)
    })

    it("leaves the property itself out of the market it is compared against", async () => {
      await rivals(5)
      // Our own property trades at twice the market.
      await seedBooking({ checkIn: iso(40), checkOut: iso(41), rates: [100_000] })

      const admin = await partner("admin")
      const res = await get(
        admin,
        `comparables?from=${iso(40)}&to=${iso(41)}&propertyId=${fx.ritz.id}`
      ).expect(200)

      expect(res.body.mine.adr).toBe(100_000)
      // Still exactly the rivals' rate — our own $1000 night pulled nothing.
      expect(res.body.market.adr).toBe(50_000)
      expect(res.body.versus.adr).toBeCloseTo(1, 10)
    })

    it("refuses to compare a whole portfolio, which would mean nothing", async () => {
      const admin = await partner("admin")
      await get(admin, `comparables?from=${iso(40)}&to=${iso(41)}`).expect(404)
    })
  })

  /* =================================================== search events (#67) */

  describe("search events (rules #67, #68)", () => {
    it("records a search and the properties it showed", async () => {
      await request(server())
        .get("/api/v1/properties?city=New%20York")
        .set("x-stayora-session", "opaque-session-id")
        .expect(200)

      const [event] = await db.select().from(searchEvents)
      expect(event).toMatchObject({ destination: "new york", resultCount: 1, surface: "web" })

      const impressions = await db.select().from(searchImpressions)
      expect(impressions).toHaveLength(1)
      expect(impressions[0]).toMatchObject({ propertyId: fx.ritz.id, position: 1 })
    })

    it("never stores the session id it was handed (rule #68)", async () => {
      await request(server())
        .get("/api/v1/properties?city=New%20York")
        .set("x-stayora-session", "opaque-session-id")
        .expect(200)

      const [event] = await db.select().from(searchEvents)
      expect(event!.sessionHash).not.toBe("opaque-session-id")
      expect(event!.sessionHash).toHaveLength(64)
    })

    it("records a search with no session at all", async () => {
      await request(server()).get("/api/v1/properties?city=New%20York").expect(200)
      const [event] = await db.select().from(searchEvents)
      expect(event!.sessionHash).toBeNull()
      expect(event!.userId).toBeNull()
    })

    it("ties a search to the account when the searcher was signed in", async () => {
      const g = await guest()
      await request(server())
        .get("/api/v1/properties?city=New%20York")
        .set("Cookie", g.cookie)
        .expect(200)

      const [event] = await db.select().from(searchEvents)
      expect(event!.userId).toBe(g.id)
    })

    it("records the searches that found nothing — the interesting ones", async () => {
      await request(server()).get("/api/v1/properties?city=Nowhere").expect(200)
      const [event] = await db.select().from(searchEvents)
      expect(event).toMatchObject({ destination: "nowhere", resultCount: 0 })
    })

    it("hands back an id the browser can report a click against", async () => {
      const res = await request(server()).get("/api/v1/properties?city=New%20York").expect(200)
      expect(res.body.searchId).toEqual(expect.any(String))

      await request(server())
        .post(`/api/v1/search-events/${res.body.searchId}/click`)
        .send({ propertyId: fx.ritz.id })
        .expect(204)

      const [impression] = await db.select().from(searchImpressions)
      expect(impression!.clickedAt).not.toBeNull()
    })

    it("keeps the FIRST click, not the last", async () => {
      const res = await request(server()).get("/api/v1/properties?city=New%20York").expect(200)
      const click = () =>
        request(server())
          .post(`/api/v1/search-events/${res.body.searchId}/click`)
          .send({ propertyId: fx.ritz.id })
          .expect(204)

      await click()
      const [first] = await db.select().from(searchImpressions)
      await click()
      const [second] = await db.select().from(searchImpressions)

      expect(second!.clickedAt).toBe(first!.clickedAt)
    })

    /*
     * Answering "no such search" would make this an oracle over event ids, and
     * there is nothing a caller could do with the truth.
     */
    it("says nothing about whether a search id is real", async () => {
      await request(server())
        .post(`/api/v1/search-events/0198f000-0000-7000-8000-000000000009/click`)
        .send({ propertyId: fx.ritz.id })
        .expect(204)
    })

    it("refuses a click body carrying anything extra (API3)", async () => {
      const res = await request(server()).get("/api/v1/properties?city=New%20York").expect(200)
      await request(server())
        .post(`/api/v1/search-events/${res.body.searchId}/click`)
        .send({ propertyId: fx.ritz.id, position: 1 })
        .expect(400)
    })

    it("falls back to `web` for a surface it does not recognise", async () => {
      await request(server())
        .get("/api/v1/properties?city=New%20York")
        .set("x-stayora-surface", "carrier-pigeon")
        .expect(200)

      const [event] = await db.select().from(searchEvents)
      expect(event!.surface).toBe("web")
    })

    it("keeps the surface when it is one the product knows", async () => {
      await request(server())
        .get("/api/v1/properties?city=New%20York")
        .set("x-stayora-surface", "app")
        .expect(200)

      const [event] = await db.select().from(searchEvents)
      expect(event!.surface).toBe("app")
    })

    /*
     * Rule #67's other half: recording must never be able to fail a search.
     * A session header far past the column's width would once have been a
     * `value too long` from Postgres on every search that carried it.
     */
    it("still returns hotels when the recording cannot be written", async () => {
      const res = await request(server())
        .get("/api/v1/properties?city=New%20York")
        .set("x-stayora-session", "x".repeat(5_000))
        .expect(200)

      expect(res.body.items).toHaveLength(1)
    })

    it("stores no IP address and no user agent (rule #68)", async () => {
      await request(server())
        .get("/api/v1/properties?city=New%20York")
        .set("x-forwarded-for", "203.0.113.7")
        .set("User-Agent", "Mozilla/5.0 (probe)")
        .expect(200)

      const columns = await db.execute<{ column_name: string }>(sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'search_events'
      `)
      const names = columns.rows.map((r) => r.column_name)
      expect(names).not.toContain("ip_address")
      expect(names).not.toContain("user_agent")
    })
  })
})
