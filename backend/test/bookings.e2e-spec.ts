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
import { signWebhook } from "../src/modules/payments/provider/fake.provider"
import {
  bookingEvents,
  bookings,
  notificationOutbox,
  partnerMembers,
  partnerOrgs,
  paymentEvents,
  payments,
  promotionProperties,
  promotions,
  properties,
  ratePlans,
  roomInventory,
  rooms,
  users,
  valueAdds,
} from "../src/db/schema"

const strong = "correct horse battery staple"
const iso = (offset: number) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

describe("bookings", () => {
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

  /** `units` is deliberately small so the last-room race is reachable. */
  async function seed(units = 1) {
    const [org] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora", status: "active", commissionRateBps: 1500 })
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
    const [deluxe] = await db
      .insert(rooms)
      .values({
        propertyId: ritz!.id,
        name: "Deluxe King Room",
        maxAdults: 2,
        maxChildren: 1,
        maxOccupancy: 2,
        units,
      })
      .returning()
    const [standard] = await db
      .insert(rooms)
      .values({
        propertyId: ritz!.id,
        name: "Standard Room",
        maxAdults: 2,
        maxChildren: 0,
        maxOccupancy: 2,
        units: 5,
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
    const [standardPlan] = await db
      .insert(ratePlans)
      .values({
        roomId: standard!.id,
        name: "Flexible",
        basePrice: 58_000,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        isDefault: true,
      })
      .returning()
    const [transfer] = await db
      .insert(valueAdds)
      .values({ propertyId: ritz!.id, name: "Airport transfer", price: 6_500, unit: "per_stay" })
      .returning()

    return { org: org!, ritz: ritz!, deluxe: deluxe!, standard: standard!, flexible: flexible!, standardPlan: standardPlan!, transfer: transfer! }
  }

  async function guest(email = `g${n}@example.com`) {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "John", lastName: "Doe" })
      .expect(201)

    // Signup no longer hands back a session (rule #58): a cookie for a new
    // account and none for an existing one would be the same leak restated.
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    return { cookie: res.headers["set-cookie"] as unknown as string[], id: res.body.user.id as string }
  }

  async function partner(email: string, role: "admin" | "manager" | "staff") {
    const g = await guest(email)
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, g.id))
    await db.insert(partnerMembers).values({ orgId: fx.org.id, userId: g.id, role, status: "active" })
    return g.cookie
  }

  const quoteFor = async (cookie: string[], over: Record<string, unknown> = {}) => {
    const res = await request(server())
      .post("/api/v1/properties/the-ritz-carlton/quote")
      .set("Cookie", cookie)
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
    return res.body.quoteToken as string
  }

  const book = (cookie: string[], quoteToken: string, key = `key-${Math.random()}`) =>
    request(server())
      .post("/api/v1/bookings")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .set("Idempotency-Key", key)
      .send({
        quoteToken,
        guest: { firstName: "John", lastName: "Doe", email: "john@example.com" },
      })

  /**
   * Takes a booking from `pending` to `confirmed` the way the product does.
   *
   * A booking no longer confirms itself (rule #44): it holds inventory for
   * fifteen minutes and waits for money. Every test below that needs a live
   * booking goes through this, because that is now the only way to get one.
   */
  const pay = async (cookie: string[], bookingId: string) => {
    await request(server())
      .post("/api/v1/payments/start")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .send({ bookingId })
      .expect(201)

    const [payment] = await db.select().from(payments).where(eq(payments.bookingId, bookingId))
    // Sent as a STRING, and signed as the bytes of that same string. Handing
    // supertest a Buffer with a JSON content type gets it serialised into
    // `{"type":"Buffer","data":[...]}`, which is not what was signed — the
    // exact class of mistake the raw-body handling exists to prevent.
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
  }

  /** Book and pay — the shape almost every test below actually wants. */
  const booked = async (cookie: string[], token?: string) => {
    const res = await book(cookie, token ?? (await quoteFor(cookie))).expect(201)
    await pay(cookie, res.body.booking.id)
    return res
  }

  beforeEach(async () => {
    await cleanup()
    fx = await seed()
  })

  /* ---------------------------------------------------------------- create */

  it("creates a booking from a signed quote, holding it unpaid (rule #44)", async () => {
    const g = await guest()
    const res = await book(g.cookie, await quoteFor(g.cookie)).expect(201)

    expect(res.body.booking).toMatchObject({
      // Not `confirmed`. The room is held for fifteen minutes while the guest
      // pays; confirming before the money moved is what let a script empty a
      // hotel for free.
      status: "pending",
      propertyName: "The Ritz-Carlton",
      roomName: "Deluxe King Room",
      ratePlanName: "Flexible",
      total: 217_500,
    })
    expect(res.body.booking.ref).toMatch(/^STY-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)

    await pay(g.cookie, res.body.booking.id)
    const confirmed = await request(server())
      .get(`/api/v1/bookings/${res.body.booking.id}`)
      .set("Cookie", g.cookie)
      .expect(200)
    expect(confirmed.body.booking.status).toBe("confirmed")
  })

  it("claims the inventory it sold", async () => {
    const g = await guest()
    await book(g.cookie, await quoteFor(g.cookie)).expect(201)

    const rows = await db.select().from(roomInventory).where(eq(roomInventory.roomId, fx.deluxe.id))
    expect(rows).toHaveLength(3)
    for (const row of rows) {
      expect(row.bookedUnits).toBe(1)
      // Seeded from the room, which is what the CHECK compares against.
      expect(row.sellableUnits).toBe(1)
    }
  })

  it("snapshots the cancellation terms, so a later policy change cannot reach back", async () => {
    const g = await guest()
    const res = await book(g.cookie, await quoteFor(g.cookie)).expect(201)

    await db.update(ratePlans).set({ cancelFreeUntil: "non_refundable", cancelCharge: "full", cancelChargeValue: null })

    const [row] = await db.select().from(bookings).where(eq(bookings.id, res.body.booking.id))
    expect(row?.cancelFreeUntil).toBe("48h")
    expect(row?.cancelChargeValue).toBe(50)
  })

  it("records commission from the org's rate, snapshotted", async () => {
    const g = await guest()
    const res = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    const [row] = await db.select().from(bookings).where(eq(bookings.id, res.body.booking.id))

    expect(row?.commissionRateBps).toBe(1500)
    expect(row?.commissionAmount).toBe(32_625) // 15% of $2,175
    expect(row?.commissionStatus).toBe("pending")
  })

  it("writes the first audit event", async () => {
    const g = await guest()
    const res = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    const events = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, res.body.booking.id))

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ fromStatus: null, toStatus: "pending", actor: "guest" })
  })

  it("records the confirmation as the payment's doing, not the guest's", async () => {
    const g = await guest()
    const res = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    await pay(g.cookie, res.body.booking.id)

    const events = await db.select().from(bookingEvents).where(eq(bookingEvents.bookingId, res.body.booking.id))
    expect(events).toHaveLength(2)
    expect(events[1]).toMatchObject({
      fromStatus: "pending",
      toStatus: "confirmed",
      actor: "system",
    })
  })

  it("prices add-ons from the signed quote, not a fresh calculation", async () => {
    const g = await guest()
    const token = await quoteFor(g.cookie, { addOns: [{ valueAddId: fx.transfer.id, qty: 1 }] })

    // The partner changes the price AFTER the quote was issued.
    await db.update(valueAdds).set({ price: 99_900 }).where(eq(valueAdds.id, fx.transfer.id))

    const res = await book(g.cookie, token).expect(201)
    // The guest is charged what they agreed to.
    expect(res.body.booking.total).toBe(224_000) // 217500 + 6500
  })

  /* ------------------------------------------------------ THE RACE (§4) -- */

  it("lets exactly ONE of two simultaneous bookings win the last room", async () => {
    // The single most important test in the system. Both callers are told the
    // room is available — both are right — and only the database can settle it.
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    const [tokenA, tokenB] = await Promise.all([quoteFor(a.cookie), quoteFor(b.cookie)])

    const [resA, resB] = await Promise.all([book(a.cookie, tokenA), book(b.cookie, tokenB)])

    const statuses = [resA.status, resB.status].sort()
    expect(statuses).toEqual([201, 409])

    const rows = await db.select().from(bookings)
    expect(rows).toHaveLength(1)

    const loser = resA.status === 409 ? resA : resB
    expect(loser.body.code).toBe("just_sold_out")
  })

  it("offers the loser the rooms that are still free (rule #24)", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    const [tokenA, tokenB] = await Promise.all([quoteFor(a.cookie), quoteFor(b.cookie)])
    const [resA, resB] = await Promise.all([book(a.cookie, tokenA), book(b.cookie, tokenB)])

    const loser = resA.status === 409 ? resA : resB
    // Not a dead end: the Standard Room is still bookable for the same dates.
    expect(loser.body.alternatives).toHaveLength(1)
    expect(loser.body.alternatives[0]).toMatchObject({ roomName: "Standard Room", totalRate: 174_000 })
  })

  it("survives five simultaneous bookings on one room", async () => {
    const guests = await Promise.all(
      Array.from({ length: 5 }, (_, i) => guest(`race${i}@example.com`))
    )
    const tokens = await Promise.all(guests.map((g) => quoteFor(g.cookie)))
    const results = await Promise.all(guests.map((g, i) => book(g.cookie, tokens[i]!)))

    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
    expect(results.filter((r) => r.status === 409)).toHaveLength(4)
    expect(await db.select().from(bookings)).toHaveLength(1)
  })

  it("refuses to sell a room the property just closed", async () => {
    const g = await guest()
    const token = await quoteFor(g.cookie)

    const partnerCookie = await partner("sarah@aurora.test", "admin")
    await request(server())
      .post("/api/v1/partner/inventory/close")
      .set("Cookie", partnerCookie)
      .send({ propertyId: fx.ritz.id, from: iso(10), to: iso(12), isClosed: true })
      .expect(201)

    // The quote is still signed and unexpired — but the room is gone.
    const res = await book(g.cookie, token)
    expect(res.status).toBe(409)
  })

  /* ----------------------------------------------------------- idempotency */

  it("returns ONE booking for a double-submitted confirm (API4)", async () => {
    const g = await guest()
    const token = await quoteFor(g.cookie)
    const key = "double-tap-key-123"

    const first = await book(g.cookie, token, key).expect(201)
    const second = await book(g.cookie, token, key).expect(201)

    expect(second.body.booking.id).toBe(first.body.booking.id)
    expect(await db.select().from(bookings)).toHaveLength(1)
  })

  it("rejects the same key with a different body", async () => {
    const g = await guest()
    const key = "reused-key-456"
    await book(g.cookie, await quoteFor(g.cookie), key).expect(201)

    // A client bug — hiding it behind the first booking would be worse.
    await request(server())
      .post("/api/v1/bookings")
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .set("Idempotency-Key", key)
      .send({
        quoteToken: await quoteFor(g.cookie, { roomId: fx.standard.id, ratePlanId: fx.standardPlan.id }),
        guest: { firstName: "Someone", lastName: "Else", email: "else@example.com" },
      })
      .expect(409)
  })

  it("requires an idempotency key at all", async () => {
    const g = await guest()
    await request(server())
      .post("/api/v1/bookings")
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ quoteToken: await quoteFor(g.cookie), guest: { firstName: "A", lastName: "B", email: "a@b.co" } })
      .expect(400)
  })

  it("frees the key when the attempt fails, so the guest can retry", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    const key = "retry-key-789"

    // a quotes FIRST — while the room is still free. (Quoting after it sells
    // out is correctly a 400, which is a different thing being tested.)
    const doomed = await quoteFor(a.cookie)

    // b takes the only room.
    await book(b.cookie, await quoteFor(b.cookie)).expect(201)
    // a loses the race...
    await book(a.cookie, doomed, key).expect(409)
    // ...and can try the other room with the SAME key.
    const retry = await book(
      a.cookie,
      await quoteFor(a.cookie, { roomId: fx.standard.id, ratePlanId: fx.standardPlan.id }),
      key
    ).expect(201)
    expect(retry.body.booking.roomName).toBe("Standard Room")
  })

  /* ---------------------------------------------------------------- guards */

  it("refuses a booking without a session (rule #29)", async () => {
    const g = await guest()
    await request(server())
      .post("/api/v1/bookings")
      .set("x-forwarded-for", freshIp())
      .set("Idempotency-Key", "anon-key-1")
      .send({ quoteToken: await quoteFor(g.cookie), guest: { firstName: "A", lastName: "B", email: "a@b.co" } })
      .expect(401)
  })

  it("refuses another account's quote (API1)", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    // b tries to spend a's quote.
    await book(b.cookie, await quoteFor(a.cookie)).expect(403)
  })

  it("refuses a tampered quote", async () => {
    const g = await guest()
    const token = await quoteFor(g.cookie)
    const [body] = token.split(".")
    await book(g.cookie, `${body}.forged-signature`).expect(400)
  })

  /* ------------------------------------------------------------ visibility */

  it("404s another guest's booking — never 403 (API1)", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    const created = await book(a.cookie, await quoteFor(a.cookie)).expect(201)

    // A reference travels in screenshots and forwarded emails. A 403 would
    // confirm it is real.
    await request(server())
      .get(`/api/v1/bookings/${created.body.booking.id}`)
      .set("Cookie", b.cookie)
      .expect(404)
  })

  it("lets the property see a booking for its own room", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    const partnerCookie = await partner("sarah@aurora.test", "admin")

    await request(server())
      .get(`/api/v1/bookings/${created.body.booking.id}`)
      .set("Cookie", partnerCookie)
      .expect(200)
  })

  it("lists a guest's own bookings only", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    await book(a.cookie, await quoteFor(a.cookie)).expect(201)

    const mine = await request(server()).get("/api/v1/bookings").set("Cookie", b.cookie).expect(200)
    expect(mine.body.items).toHaveLength(0)
    expect(mine.body.nextCursor).toBeNull()
  })

  /* ---------------------------------------------------------------- paging */

  /**
   * Walks a keyset list to the end and reports what it saw.
   *
   * Deliberately collects duplicates rather than de-duplicating: a cursor that
   * repeats a row and a cursor that skips one are different bugs, and a Set
   * would hide the first while pretending to test for the second.
   */
  async function walk(path: string, cookie: string[], limit: number) {
    const seen: string[] = []
    let cursor: string | null = null
    let requests = 0

    do {
      const query = new URLSearchParams({ limit: String(limit) })
      if (cursor) query.set("cursor", cursor)
      const res = await request(server())
        .get(`${path}?${query.toString()}`)
        .set("Cookie", cookie)
        .expect(200)

      expect(Array.isArray(res.body.items)).toBe(true)
      expect(res.body.items.length).toBeLessThanOrEqual(limit)
      seen.push(...res.body.items.map((b: { id: string }) => b.id))
      cursor = res.body.nextCursor
      requests += 1
      // A cursor that never clears is an infinite loop in production, not a
      // slow test. Fail here rather than hang.
      expect(requests).toBeLessThan(25)
    } while (cursor)

    return { seen, requests }
  }

  it("pages a guest's own bookings without losing or repeating one", async () => {
    const g = await guest()
    const made: string[] = []
    // Non-overlapping stays: the fixture room has ONE unit, on purpose.
    for (let i = 0; i < 5; i += 1) {
      const res = await booked(
        g.cookie,
        await quoteFor(g.cookie, { checkIn: iso(20 + i * 3), checkOut: iso(22 + i * 3) })
      )
      made.push(res.body.booking.id)
    }

    const { seen, requests } = await walk("/api/v1/bookings", g.cookie, 2)

    expect(requests).toBeGreaterThan(1)
    expect(new Set(seen).size).toBe(seen.length)
    expect([...seen].sort()).toEqual([...made].sort())
  })

  /**
   * The one that would have failed without the id tiebreak.
   *
   * The partner list sorts by `check_in`, a DATE. Five bookings arriving on
   * the SAME day all share the sort value, so a cursor of `check_in > X`
   * alone walks straight past four of them — from a list that looks complete,
   * which is how a front desk loses an arrival.
   */
  it("pages the partner list across bookings that share a check-in date", async () => {
    // Five units, so five different guests can arrive on the same day — which
    // is the whole point of this test and impossible with the default of one.
    await cleanup()
    fx = await seed(5)

    const partnerCookie = await partner("sarah@aurora.test", "admin")

    const made: string[] = []
    for (let i = 0; i < 5; i += 1) {
      const g = await guest(`same-day-${i}@example.com`)
      const res = await booked(g.cookie)
      made.push(res.body.booking.id)
    }

    const { seen } = await walk("/api/v1/partner/bookings", partnerCookie, 2)

    expect(new Set(seen).size).toBe(seen.length)
    expect([...seen].sort()).toEqual([...made].sort())
  })

  it("filters the partner list by status on the server", async () => {
    const partnerCookie = await partner("sarah@aurora.test", "admin")
    const g = await guest()
    await booked(g.cookie)

    const confirmed = await request(server())
      .get("/api/v1/partner/bookings?status=confirmed")
      .set("Cookie", partnerCookie)
      .expect(200)
    expect(confirmed.body.items).toHaveLength(1)

    const cancelled = await request(server())
      .get("/api/v1/partner/bookings?status=cancelled")
      .set("Cookie", partnerCookie)
      .expect(200)
    expect(cancelled.body.items).toHaveLength(0)
  })

  it("treats a cursor it cannot read as the start, not an error", async () => {
    const g = await guest()
    await booked(g.cookie)

    // A link somebody pasted, or a cursor that outlived a deploy. The intent
    // is unambiguous; refusing it would be a 400 for a request that is fine.
    const res = await request(server())
      .get("/api/v1/bookings?cursor=not-a-real-cursor")
      .set("Cookie", g.cookie)
      .expect(200)
    expect(res.body.items).toHaveLength(1)
  })

  /* ---------------------------------------------------------------- cancel */

  it("cancels, refunds by policy, and releases the room", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)

    const res = await request(server())
      .post(`/api/v1/bookings/${created.body.booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)

    // Ten days out, well inside the 48h free window.
    expect(res.body.refund).toMatchObject({ refund: 217_500, refundStatus: "full" })

    const rows = await db.select().from(roomInventory).where(eq(roomInventory.roomId, fx.deluxe.id))
    for (const row of rows) expect(row.bookedUnits).toBe(0)
  })

  it("voids the commission on cancel, keeping the figure for reporting (rule #9)", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    await request(server())
      .post(`/api/v1/bookings/${created.body.booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "x" })
      .expect(201)

    const [row] = await db.select().from(bookings).where(eq(bookings.id, created.body.booking.id))
    expect(row?.commissionStatus).toBe("void")
    // Not zeroed — "commission lost to cancellations" has to stay answerable.
    expect(row?.commissionAmount).toBe(32_625)
  })

  it("refunds in FULL when the property cancels, whatever the policy (rule #37)", async () => {
    // A non-refundable rate is the guest accepting the risk of THEIR plans
    // changing, not the property's.
    await db
      .update(ratePlans)
      .set({ cancelFreeUntil: "non_refundable", cancelCharge: "full", cancelChargeValue: null })
      .where(eq(ratePlans.id, fx.flexible.id))

    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    const partnerCookie = await partner("sarah@aurora.test", "admin")

    const res = await request(server())
      .post(`/api/v1/bookings/${created.body.booking.id}/cancel`)
      .set("Cookie", partnerCookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Emergency closure" })
      .expect(201)

    expect(res.body.refund).toMatchObject({ refund: 217_500, refundStatus: "full" })
    expect(res.body.booking.cancelledBy).toBe("property")
  })

  it("charges the guest when the GUEST cancels the same non-refundable rate", async () => {
    await db
      .update(ratePlans)
      .set({ cancelFreeUntil: "non_refundable", cancelCharge: "full", cancelChargeValue: null })
      .where(eq(ratePlans.id, fx.flexible.id))

    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    const res = await request(server())
      .post(`/api/v1/bookings/${created.body.booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)

    expect(res.body.refund).toMatchObject({ refund: 0, refundStatus: "none" })
  })

  it("refuses to cancel twice", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    const cancel = () =>
      request(server())
        .post(`/api/v1/bookings/${created.body.booking.id}/cancel`)
        .set("Cookie", g.cookie)
        .set("x-forwarded-for", freshIp())
        .send({ reason: "x" })

    await cancel().expect(201)
    // The state machine, not a stray `if` — a cancelled booking is terminal.
    await cancel().expect(400)
  })

  it("honours a quote whose promotion was paused after it was issued (rule #36)", async () => {
    // The rule #36 / API6 boundary, and the reason it is not a contradiction.
    //
    // A promotion cannot be injected by a client — it travels inside the
    // server's own signed token. So a token issued 30 seconds ago is honoured
    // even if the partner has paused the offer since: the guest agreed to that
    // price, and 15 minutes is short enough that the partner has lost nothing
    // they can name.
    const [promo] = await db
      .insert(promotions)
      .values({
        name: "Flash Sale",
        discountType: "percent",
        discountValue: 20,
        startDate: iso(-1),
        endDate: iso(365),
        status: "active",
      })
      .returning()
    await db.insert(promotionProperties).values({ promotionId: promo!.id, propertyId: fx.ritz.id })

    const g = await guest()
    const token = await quoteFor(g.cookie)

    // The partner pulls the offer AFTER the quote was signed.
    await db.update(promotions).set({ status: "paused" }).where(eq(promotions.id, promo!.id))

    const res = await book(g.cookie, token).expect(201)
    // 217500 − 20%
    expect(res.body.booking.total).toBe(174_000)
    expect(res.body.booking.pricing.discount).toMatchObject({ amount: -43_500 })
  })

  /* ---------------------------------------------------------------- modify */

  const modify = (cookie: string[], id: string, token: string) =>
    request(server())
      .post(`/api/v1/bookings/${id}/modify`)
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .send({ quoteToken: token })

  const heldDates = async () => {
    const rows = await db.select().from(roomInventory).where(eq(roomInventory.roomId, fx.deluxe.id))
    return rows.filter((r) => r.bookedUnits > 0).map((r) => r.date).sort()
  }

  it("moves a booking to new dates and swaps its inventory (rule #38)", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)

    const res = await modify(
      g.cookie,
      created.body.booking.id,
      await quoteFor(g.cookie, { checkIn: iso(20), checkOut: iso(23) })
    ).expect(201)

    expect(res.body.booking.checkIn).toBe(iso(20))
    // The old nights are free again and the new ones are held.
    expect(await heldDates()).toEqual([iso(20), iso(21), iso(22)])
  })

  it("shifts by ONE night without the booking blocking itself", async () => {
    // The overlap case, and the reason `modifyBookingId` exists at all. The
    // booking already holds nights 10-12 on a room with ONE unit, so a plain
    // quote for 11-14 correctly reads as sold out. Naming the booking being
    // moved is what lets the guest stop competing with their own reservation.
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)

    await modify(
      g.cookie,
      created.body.booking.id,
      await quoteFor(g.cookie, {
        checkIn: iso(11),
        checkOut: iso(14),
        modifyBookingId: created.body.booking.id,
      })
    ).expect(201)

    expect(await heldDates()).toEqual([iso(11), iso(12), iso(13)])

    const rows = await db.select().from(roomInventory).where(eq(roomInventory.roomId, fx.deluxe.id))
    // ...and never double-held on the overlapping nights.
    for (const row of rows) expect(row.bookedUnits).toBeLessThanOrEqual(1)
  })

  it("reports the price delta at CURRENT rates (rule #17)", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)

    const partnerCookie = await partner("sarah@aurora.test", "admin")
    await request(server())
      .post("/api/v1/partner/inventory/rates")
      .set("Cookie", partnerCookie)
      .send({ ratePlanId: fx.flexible.id, from: iso(20), to: iso(22), rate: 140_000 })
      .expect(201)

    const res = await modify(
      g.cookie,
      created.body.booking.id,
      await quoteFor(g.cookie, { checkIn: iso(20), checkOut: iso(23) })
    ).expect(201)

    // Shifting into a peak week costs what that week costs.
    expect(res.body.priceChange).toMatchObject({
      previousTotal: 217_500,
      newTotal: 420_000,
      delta: 202_500,
      settlement: "due",
      // Payments are Module 7 — the balance is reported, not moved.
      settled: false,
    })
  })

  it("reports a refund when the change is cheaper", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)

    const res = await modify(
      g.cookie,
      created.body.booking.id,
      await quoteFor(g.cookie, { checkIn: iso(20), checkOut: iso(22) })
    ).expect(201)

    expect(res.body.priceChange).toMatchObject({ delta: -72_500, settlement: "refund" })
  })

  it("updates the commission to follow the new total", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    await modify(
      g.cookie,
      created.body.booking.id,
      await quoteFor(g.cookie, { checkIn: iso(20), checkOut: iso(22) })
    ).expect(201)

    const [row] = await db.select().from(bookings).where(eq(bookings.id, created.body.booking.id))
    expect(row?.total).toBe(145_000)
    expect(row?.commissionAmount).toBe(21_750) // 15% of the NEW total
    // ...at the rate snapshotted when the booking was made.
    expect(row?.commissionRateBps).toBe(1500)
  })

  it("leaves the original booking untouched when the new dates are gone", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    const created = await book(a.cookie, await quoteFor(a.cookie)).expect(201)

    // The later week is quoted while it is still free...
    const token = await quoteFor(a.cookie, { checkIn: iso(20), checkOut: iso(23) })
    // ...but somebody else takes it first.
    await book(b.cookie, await quoteFor(b.cookie, { checkIn: iso(20), checkOut: iso(23) })).expect(201)

    const res = await modify(a.cookie, created.body.booking.id, token)
    expect(res.status).toBe(409)

    // One transaction: the original nights were never given up.
    const [row] = await db.select().from(bookings).where(eq(bookings.id, created.body.booking.id))
    expect(row?.checkIn).toBe(iso(10))
    expect(await heldDates()).toEqual([iso(10), iso(11), iso(12), iso(20), iso(21), iso(22)])
  })

  it("refuses a plain quote for the nights the booking itself holds", async () => {
    // Without naming the booking, its own units count against it — which is
    // correct, and is exactly what `modifyBookingId` is scoped to undo.
    const g = await guest()
    await book(g.cookie, await quoteFor(g.cookie)).expect(201)

    await request(server())
      .post("/api/v1/properties/the-ritz-carlton/quote")
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ roomId: fx.deluxe.id, ratePlanId: fx.flexible.id, checkIn: iso(11), checkOut: iso(14) })
      .expect(400)
  })

  it("ignores another guest's booking id, so it cannot excuse their inventory (API1)", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    const created = await book(a.cookie, await quoteFor(a.cookie)).expect(201)

    // b names a's booking to try to free up the room. Ownership is checked
    // server-side, so the id simply has no effect and the nights stay sold.
    await request(server())
      .post("/api/v1/properties/the-ritz-carlton/quote")
      .set("Cookie", b.cookie)
      .set("x-forwarded-for", freshIp())
      .send({
        roomId: fx.deluxe.id,
        ratePlanId: fx.flexible.id,
        checkIn: iso(11),
        checkOut: iso(14),
        modifyBookingId: created.body.booking.id,
      })
      .expect(400)
  })

  it("re-snapshots the commission on the new total, at the OLD rate (rule #51)", async () => {
    const g = await guest()
    const created = await booked(g.cookie)
    const [before] = await db.select().from(bookings).where(eq(bookings.id, created.body.booking.id))
    expect(before!.commissionAmount).toBe(32_625) // 15% of $2,175

    // The org renegotiates AFTER the booking was made.
    await db.update(partnerOrgs).set({ commissionRateBps: 500 }).where(eq(partnerOrgs.id, fx.org.id))

    // Four nights instead of three. The booking already holds three of them on
    // a one-unit room, so it has to be named — otherwise the guest competes
    // with their own reservation.
    const res = await modify(
      g.cookie,
      created.body.booking.id,
      await quoteFor(g.cookie, {
        checkIn: iso(10),
        checkOut: iso(14),
        modifyBookingId: created.body.booking.id,
      })
    )
    expect(res.status).toBe(201)

    const [after] = await db.select().from(bookings).where(eq(bookings.id, created.body.booking.id))

    // The AMOUNT follows the new total: the guest bought more, so the platform
    // earns on more. The RATE does not: a rate renegotiated today must not
    // reach back into a booking that was priced under the old one (rule #20).
    expect(after!.total).toBe(290_000)
    expect(after!.commissionRateBps).toBe(1500)
    expect(after!.commissionAmount).toBe(43_500) // 15% of $2,900, not 5%
  })

  it("refuses to change the room through modify", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    const res = await modify(
      g.cookie,
      created.body.booking.id,
      await quoteFor(g.cookie, { roomId: fx.standard.id, ratePlanId: fx.standardPlan.id })
    )
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("room_change_not_supported")
  })

  it("refuses to modify a stay in progress", async () => {
    const g = await guest()
    const created = await booked(g.cookie)
    const desk = await partner("desk@aurora.test", "staff")
    await request(server())
      .patch(`/api/v1/bookings/${created.body.booking.id}/status`)
      .set("Cookie", desk)
      .send({ status: "checked_in" })
      .expect(200)

    const res = await modify(
      g.cookie,
      created.body.booking.id,
      await quoteFor(g.cookie, { checkIn: iso(20), checkOut: iso(23) })
    )
    expect(res.status).toBe(400)
    expect(res.body.code).toBe("not_modifiable")
  })

  it("refuses another guest's booking (API1)", async () => {
    const a = await guest("a@example.com")
    const b = await guest("b@example.com")
    const created = await book(a.cookie, await quoteFor(a.cookie)).expect(201)

    await modify(
      b.cookie,
      created.body.booking.id,
      await quoteFor(b.cookie, { checkIn: iso(20), checkOut: iso(23) })
    ).expect(404)
  })

  it("refuses staff on a date change (rule #14)", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    const desk = await partner("desk@aurora.test", "staff")

    await modify(
      desk,
      created.body.booking.id,
      await quoteFor(g.cookie, { checkIn: iso(20), checkOut: iso(23) })
    ).expect(403)
  })

  it("records the change in the audit trail", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    await modify(
      g.cookie,
      created.body.booking.id,
      await quoteFor(g.cookie, { checkIn: iso(20), checkOut: iso(23) })
    ).expect(201)

    const detail = await request(server())
      .get(`/api/v1/bookings/${created.body.booking.id}`)
      .set("Cookie", g.cookie)
      .expect(200)

    expect(detail.body.events).toHaveLength(2)
    expect(detail.body.events[1].reason).toContain(iso(20))
  })

  /* --------------------------------------------------------- state machine */

  it("walks the front-desk path and earns the commission", async () => {
    const g = await guest()
    const created = await booked(g.cookie)
    const id = created.body.booking.id
    const desk = await partner("desk@aurora.test", "staff")

    const setStatus = (status: string, cookie: string[], extra = {}) =>
      request(server())
        .patch(`/api/v1/bookings/${id}/status`)
        .set("Cookie", cookie)
        .send({ status, ...extra })

    await setStatus("checked_in", desk, { roomNo: "1204" }).expect(200)
    await setStatus("completed", desk).expect(200)

    const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
    expect(row?.roomNo).toBe("1204")
    expect(row?.commissionStatus).toBe("earned")
  })

  it("refuses to complete a stay that was never checked in (rule #6)", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)
    const manager = await partner("m@aurora.test", "manager")

    await request(server())
      .patch(`/api/v1/bookings/${created.body.booking.id}/status`)
      .set("Cookie", manager)
      .send({ status: "completed" })
      .expect(400)
  })

  it("refuses staff on a no-show, and allows a manager (rule #14)", async () => {
    const g = await guest()
    const created = await booked(g.cookie)
    const id = created.body.booking.id

    const desk = await partner("desk@aurora.test", "staff")
    await request(server())
      .patch(`/api/v1/bookings/${id}/status`)
      .set("Cookie", desk)
      .send({ status: "no_show" })
      .expect(400)

    const manager = await partner("m@aurora.test", "manager")
    await request(server())
      .patch(`/api/v1/bookings/${id}/status`)
      .set("Cookie", manager)
      .send({ status: "no_show" })
      .expect(200)

    const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
    // No stay, no commission (rule #9).
    expect(row?.commissionStatus).toBe("void")
  })

  it("refuses a guest driving the front desk", async () => {
    const g = await guest()
    const created = await book(g.cookie, await quoteFor(g.cookie)).expect(201)

    await request(server())
      .patch(`/api/v1/bookings/${created.body.booking.id}/status`)
      .set("Cookie", g.cookie)
      .send({ status: "checked_in" })
      .expect(400)
  })

  it("records every transition in the audit trail", async () => {
    const g = await guest()
    const created = await booked(g.cookie)
    const desk = await partner("desk@aurora.test", "staff")

    await request(server())
      .patch(`/api/v1/bookings/${created.body.booking.id}/status`)
      .set("Cookie", desk)
      .send({ status: "checked_in" })
      .expect(200)

    const detail = await request(server())
      .get(`/api/v1/bookings/${created.body.booking.id}`)
      .set("Cookie", g.cookie)
      .expect(200)

    // Three now: created → pending, payment → confirmed, desk → checked_in.
    expect(detail.body.events).toHaveLength(3)
    expect(detail.body.events[2]).toMatchObject({
      fromStatus: "confirmed",
      toStatus: "checked_in",
      actor: "partner_staff",
    })
  })
})
