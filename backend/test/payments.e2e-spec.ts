import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { and, eq } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { resetDb } from "./support/reset-db"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import { HoldsService } from "../src/modules/payments/holds.service"
import { NotificationsService } from "../src/modules/notifications/notifications.service"
import { FakeEmailProvider } from "../src/modules/notifications/provider/fake-email.provider"
import { PaymentsJobs } from "../src/modules/payments/payments.jobs"
import { FakePaymentProvider, signWebhook } from "../src/modules/payments/provider/fake.provider"
import {
  bookingEvents,
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

describe("payments", () => {
  let app: NestExpressApplication
  let db: Database
  let holds: HoldsService
  let fake: FakePaymentProvider
  let jobs: PaymentsJobs
  let mail: FakeEmailProvider
  let notifications: NotificationsService

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
    holds = moduleRef.get(HoldsService)
    fake = moduleRef.get(FakePaymentProvider)
    jobs = moduleRef.get(PaymentsJobs)
    mail = moduleRef.get(FakeEmailProvider)
    notifications = moduleRef.get(NotificationsService)
  })

  afterAll(async () => {
    await cleanup()
    await app?.close()
  })

  const cleanup = async () => {
    await resetDb(db)
    mail.reset()
  }

  const server = () => app.getHttpServer()
  let n = 0
  const freshIp = () => `192.0.2.${++n % 250}`

  type Fixture = Awaited<ReturnType<typeof seed>>
  let fx: Fixture

  /** `price` steers the fake provider: …01 declines, …02 needs 3-D Secure. */
  async function seed(price = 72_500) {
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
        basePrice: price,
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
        units: 2,
      })
      .returning()
    const [prepay] = await db
      .insert(ratePlans)
      .values({
        roomId: deluxe!.id,
        name: "Flexible",
        basePrice: price,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        paymentMode: "prepay",
        isDefault: true,
      })
      .returning()
    const [guarantee] = await db
      .insert(ratePlans)
      .values({
        roomId: deluxe!.id,
        name: "Pay at the property",
        basePrice: price,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        paymentMode: "guarantee",
      })
      .returning()

    return { org: org!, ritz: ritz!, deluxe: deluxe!, prepay: prepay!, guarantee: guarantee! }
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

  const quoteFor = async (cookie: string[], ratePlanId: string, nights = 3) => {
    const res = await request(server())
      .post("/api/v1/properties/the-ritz-carlton/quote")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .send({
        roomId: fx.deluxe.id,
        ratePlanId,
        checkIn: iso(10),
        checkOut: iso(10 + nights),
        adults: 2,
      })
      .expect(201)
    return res.body.quoteToken as string
  }

  const book = async (cookie: string[], ratePlanId: string, nights = 3) => {
    const res = await request(server())
      .post("/api/v1/bookings")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .set("Idempotency-Key", `key-${++n}-${Math.random()}`)
      .send({
        quoteToken: await quoteFor(cookie, ratePlanId, nights),
        guest: { firstName: "Amelia", lastName: "Hart", email: "amelia@example.com" },
      })
      .expect(201)
    return res.body.booking as { id: string; status: string; total: number }
  }

  /** A booking whose stay starts `inDays` from now — for arrival-time rules. */
  const bookOn = async (cookie: string[], ratePlanId: string, inDays: number, nights: number) => {
    const token = await request(server())
      .post("/api/v1/properties/the-ritz-carlton/quote")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .send({
        roomId: fx.deluxe.id,
        ratePlanId,
        checkIn: iso(inDays),
        checkOut: iso(inDays + nights),
        adults: 2,
      })
      .expect(201)

    const res = await request(server())
      .post("/api/v1/bookings")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .set("Idempotency-Key", `key-${++n}-${Math.random()}`)
      .send({
        quoteToken: token.body.quoteToken,
        guest: { firstName: "Amelia", lastName: "Hart", email: "amelia@example.com" },
      })
      .expect(201)
    return res.body.booking as { id: string; status: string; total: number }
  }

  async function partnerCookie(email: string, role: "admin" | "manager" | "staff") {
    const g = await guest(email)
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, g.id))
    await db.insert(partnerMembers).values({ orgId: fx.org.id, userId: g.id, role, status: "active" })
    return g.cookie
  }

  const start = (cookie: string[], bookingId: string, extra: Record<string, unknown> = {}) =>
    request(server())
      .post("/api/v1/payments/start")
      .set("Cookie", cookie)
      .set("x-forwarded-for", freshIp())
      .send({ bookingId, ...extra })

  /**
   * Empties the mailbox for real.
   *
   * `mail.reset()` clears what the fake has SENT; it does not clear the
   * OUTBOX. Anything queued and undelivered — a signup welcome, a booking
   * confirmation — arrives on the next `deliverDue()` and lands in the middle
   * of whatever the test was about to assert. Draining first is the only way
   * to start from nothing.
   */
  const drainMail = async () => {
    await notifications.deliverDue()
    mail.reset()
  }

  const paymentFor = async (bookingId: string) => {
    const [row] = await db.select().from(payments).where(eq(payments.bookingId, bookingId))
    return row!
  }

  /** A signed provider callback, exactly as the real adapter would verify one. */
  const webhook = (
    event: Record<string, unknown>,
    over: { signature?: string | null } = {}
  ) => {
    const body = JSON.stringify(event)
    const req = request(server())
      .post("/api/v1/payments/webhook")
      .set("Content-Type", "application/json")

    const signature =
      over.signature === undefined ? signWebhook(Buffer.from(body, "utf8")) : over.signature
    if (signature !== null) req.set("x-payment-signature", signature)

    return req.send(body)
  }

  const captured = (providerRef: string, amount: number, id = `evt_${++n}`) =>
    webhook({
      id,
      type: "payment.captured",
      providerRef,
      amount,
      currency: "USD",
      cardBrand: "visa",
      cardLast4: "4242",
    })

  /**
   * A card verified and saved, the way a real provider reports one.
   *
   * `providerMethodRef` is the point of the whole event: it is the handle the
   * platform charges later for a penalty or a no-show. The fake mints it at
   * intent time and hands it over here, exactly as a processor would.
   */
  const authorized = (providerRef: string, id = `evt_${++n}`) =>
    webhook({
      id,
      type: "payment.authorized",
      providerRef,
      amount: 0,
      currency: "USD",
      cardBrand: "visa",
      cardLast4: "4242",
      providerMethodRef: fake.methodRefFor(providerRef),
    })

  const statusOf = async (cookie: string[], bookingId: string) => {
    const res = await request(server())
      .get(`/api/v1/bookings/${bookingId}`)
      .set("Cookie", cookie)
      .expect(200)
    return res.body.booking.status as string
  }

  beforeEach(async () => {
    await cleanup()
    fx = await seed()
    mail.reset()
  })

  /* --------------------------------------------------------------- prepay */

  it("confirms a prepay booking only once the money is captured (rule #44)", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    expect(booking.status).toBe("pending")

    const session = await start(g.cookie, booking.id).expect(201)
    expect(session.body).toMatchObject({ mode: "prepay", amount: booking.total })
    expect(session.body.clientSecret).toBeTruthy()

    // Still pending: an intent is not money.
    expect(await statusOf(g.cookie, booking.id)).toBe("pending")

    const payment = await paymentFor(booking.id)
    await captured(payment.providerRef!, booking.total).expect(201)

    expect(await statusOf(g.cookie, booking.id)).toBe("confirmed")
  })

  it("drops the hold once the booking confirms", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await captured(payment.providerRef!, booking.total).expect(201)

    const [row] = await db.select().from(bookings).where(eq(bookings.id, booking.id))
    // A confirmed booking carrying a hold is one the sweeper would come back
    // for; the table constraint refuses it outright.
    expect(row!.holdExpiresAt).toBeNull()
  })

  /* ------------------------------------------------------------ guarantee */

  it("confirms a guarantee booking on an authorization, taking nothing", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.guarantee.id)

    const session = await start(g.cookie, booking.id).expect(201)
    // The card is proved, not charged. That zero is the whole difference.
    expect(session.body).toMatchObject({ mode: "guarantee", amount: 0 })

    const payment = await paymentFor(booking.id)
    expect(payment.kind).toBe("guarantee")
    await authorized(payment.providerRef!).expect(201)

    expect(await statusOf(g.cookie, booking.id)).toBe("confirmed")
    const after = await paymentFor(booking.id)
    expect(after.status).toBe("authorized")
    expect(after.amount).toBe(0)
  })

  it("will not confirm a prepay booking on a mere authorization", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)

    await authorized(payment.providerRef!).expect(201)

    // A prepay rate promised the money, not a promise of the money.
    expect(await statusOf(g.cookie, booking.id)).toBe("pending")
  })

  /* --------------------------------------------------------------- resume */

  it("resumes the same intent when the guest reloads checkout", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)

    const first = await start(g.cookie, booking.id).expect(201)
    const second = await start(g.cookie, booking.id).expect(201)

    // A second intent would either double-charge them or leave an orphaned
    // authorization sitting on their card for a week.
    expect(second.body.paymentId).toBe(first.body.paymentId)
    const rows = await db.select().from(payments).where(eq(payments.bookingId, booking.id))
    expect(rows).toHaveLength(1)
  })

  it("creates ONE payment for two clicks arriving together", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)

    const [a, b] = await Promise.all([start(g.cookie, booking.id), start(g.cookie, booking.id)])

    expect([a.status, b.status]).toEqual([201, 201])
    const rows = await db.select().from(payments).where(eq(payments.bookingId, booking.id))
    expect(rows).toHaveLength(1)
  })

  /* -------------------------------------------------------------- failure */

  it("leaves the booking pending when the card is declined", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)

    await webhook({
      id: `evt_${++n}`,
      type: "payment.failed",
      providerRef: payment.providerRef,
      amount: booking.total,
      currency: "USD",
      failureReason: "Your card was declined.",
    }).expect(201)

    expect(await statusOf(g.cookie, booking.id)).toBe("pending")
    const after = await paymentFor(booking.id)
    expect(after.status).toBe("failed")
    expect(after.failureReason).toContain("declined")
  })

  it("lets the guest try again after a decline", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const first = await paymentFor(booking.id)

    await webhook({
      id: `evt_${++n}`,
      type: "payment.failed",
      providerRef: first.providerRef,
      amount: booking.total,
      currency: "USD",
      failureReason: "Declined",
    }).expect(201)

    // The partial index only blocks a second LIVE intent; a dead one must not
    // trap the guest on a booking they still want.
    const retry = await start(g.cookie, booking.id).expect(201)
    expect(retry.body.paymentId).not.toBe(first.id)
  })

  it("carries a 3-D Secure detour back to the client", async () => {
    // The fake steers on the amount: …02 means the bank wants the guest.
    await db.delete(bookings)
    fx = { ...fx }
    const g = await guest()
    await db.update(ratePlans).set({ basePrice: 70_002 }).where(eq(ratePlans.id, fx.prepay.id))
    await db.update(properties).set({ basePrice: 70_002 }).where(eq(properties.id, fx.ritz.id))

    const booking = await book(g.cookie, fx.prepay.id, 1)
    const session = await start(g.cookie, booking.id).expect(201)

    expect(session.body.status).toBe("requires_action")
    expect(session.body.redirectUrl).toContain("fake-3ds")
  })

  /* ------------------------------------------------------- webhook safety */

  it("refuses a webhook with no signature (rule #45)", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)

    await webhook(
      { id: "evt_unsigned", type: "payment.captured", providerRef: payment.providerRef, amount: 1, currency: "USD" },
      { signature: null }
    ).expect(400)

    expect(await statusOf(g.cookie, booking.id)).toBe("pending")
  })

  it("refuses a webhook with a forged signature", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)

    await webhook(
      {
        id: "evt_forged",
        type: "payment.captured",
        providerRef: payment.providerRef,
        amount: booking.total,
        currency: "USD",
      },
      { signature: "a".repeat(64) }
    ).expect(400)

    // The whole attack: confirm a booking nobody paid for.
    expect(await statusOf(g.cookie, booking.id)).toBe("pending")
  })

  it("treats a replayed webhook as a no-op (rule #45)", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)

    const first = await captured(payment.providerRef!, booking.total, "evt_replay").expect(201)
    expect(first.body.duplicate).toBe(false)

    // Providers retry until they get a 2xx, and send duplicates regardless.
    const second = await captured(payment.providerRef!, booking.total, "evt_replay").expect(201)
    expect(second.body.duplicate).toBe(true)

    const events = await db.select().from(paymentEvents)
    expect(events).toHaveLength(1)
  })

  it("ignores a webhook that arrives out of order", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)

    await captured(payment.providerRef!, booking.total).expect(201)
    // Providers promise delivery, not ordering. The row already holds the
    // later truth, and un-capturing it would lose the fact that money moved.
    await authorized(payment.providerRef!).expect(201)

    const after = await paymentFor(booking.id)
    expect(after.status).toBe("captured")
  })

  it("answers 200 for an intent it does not know, without acting", async () => {
    const res = await captured("fake_pi_never-created", 1_000).expect(201)
    // Anything else and the provider retries this for days.
    expect(res.body).toMatchObject({ handled: false })
  })

  it("survives two deliveries of the same event racing each other", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)

    const [a, b] = await Promise.all([
      captured(payment.providerRef!, booking.total, "evt_race"),
      captured(payment.providerRef!, booking.total, "evt_race"),
    ])

    expect([a.status, b.status]).toEqual([201, 201])
    expect([a.body.duplicate, b.body.duplicate].filter(Boolean)).toHaveLength(1)
    expect(await db.select().from(paymentEvents)).toHaveLength(1)
  })

  /* ----------------------------------------------------------- hold sweep */

  it("releases the inventory of a hold nobody paid for (API6)", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)

    const before = await db
      .select()
      .from(roomInventory)
      .where(eq(roomInventory.roomId, fx.deluxe.id))
    expect(before.every((r) => r.bookedUnits === 1)).toBe(true)

    // The hold lapses.
    await db
      .update(bookings)
      .set({ holdExpiresAt: new Date(Date.now() - 60_000).toISOString() })
      .where(eq(bookings.id, booking.id))

    const result = await holds.sweep()
    expect(result).toMatchObject({ released: 1, confirmed: 0 })

    const after = await db
      .select()
      .from(roomInventory)
      .where(eq(roomInventory.roomId, fx.deluxe.id))
    // The room is back on sale — this is what stops a script emptying a hotel.
    expect(after.every((r) => r.bookedUnits === 0)).toBe(true)
    expect(await statusOf(g.cookie, booking.id)).toBe("cancelled")
  })

  it("tells the guest their booking was not completed, and where to go back to", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    mail.reset()

    await db
      .update(bookings)
      .set({ holdExpiresAt: new Date(Date.now() - 60_000).toISOString() })
      .where(eq(bookings.id, booking.id))

    await holds.sweep()
    await notifications.deliverDue()

    /*
     * Until this existed the sweeper released the room and said nothing. A
     * guest who stepped away mid-checkout came back to a booking that had
     * simply vanished — the moment somebody decides the site is broken.
     */
    const message = mail.lastTo("amelia@example.com")!
    expect(message).toBeDefined()

    // NOT "cancelled": they did not cancel anything, and the useful fact is
    // that the room went back on sale and is probably still there.
    expect(message.subject).toContain("wasn't completed")
    expect(message.text).toContain("Nothing has been charged")
    expect(message.text).toContain("/hotels/the-ritz-carlton")
  })

  it("says nothing when the lapsed hold turns out to be paid", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)

    await db
      .update(payments)
      .set({ status: "captured", capturedAt: new Date().toISOString() })
      .where(eq(payments.id, payment.id))
    await db
      .update(bookings)
      .set({ holdExpiresAt: new Date(Date.now() - 60_000).toISOString() })
      .where(eq(bookings.id, booking.id))
    mail.reset()

    await holds.sweep()
    await notifications.deliverDue()

    /*
     * The other half, and the one that matters more. This booking CONFIRMS —
     * so a "we could not take your payment" email here would be telling a
     * guest whose money has already left their account that their room is
     * gone. Nothing about the hold expiring is news to them.
     */
    const sent = mail.sent.map((m) => m.subject)
    expect(sent.filter((s) => s.includes("wasn't completed"))).toHaveLength(0)
  })

  it("confirms a lapsed hold whose payment DID settle", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)

    // The money moved, and the webhook never arrived — a dropped delivery, or
    // a restart mid-request. Releasing the room here would take it from a
    // guest whose account has already been debited.
    await db
      .update(payments)
      .set({ status: "captured", capturedAt: new Date().toISOString() })
      .where(eq(payments.id, payment.id))
    await db
      .update(bookings)
      .set({ holdExpiresAt: new Date(Date.now() - 60_000).toISOString() })
      .where(eq(bookings.id, booking.id))

    const result = await holds.sweep()
    expect(result).toMatchObject({ confirmed: 1, released: 0 })
    expect(await statusOf(g.cookie, booking.id)).toBe("confirmed")
  })

  it("leaves a hold that has not lapsed alone", async () => {
    const g = await guest()
    await book(g.cookie, fx.prepay.id)
    expect(await holds.sweep()).toMatchObject({ examined: 0 })
  })

  it("refuses to start payment on a hold that has already lapsed", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await db
      .update(bookings)
      .set({ holdExpiresAt: new Date(Date.now() - 60_000).toISOString() })
      .where(eq(bookings.id, booking.id))

    const res = await start(g.cookie, booking.id).expect(409)
    expect(res.body.code).toBe("hold_expired")
  })

  /* ------------------------------------------------------- cancel & money */

  it("refunds a prepaid cancellation inside the free window (rules #1, #46)", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await captured(payment.providerRef!, booking.total).expect(201)

    const res = await request(server())
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)

    // Check-in is ten days out, so the 48h deadline has not passed.
    expect(res.body.refund.refund).toBe(booking.total)
    expect(res.body.settlement).toMatchObject({ action: "refund", amount: booking.total })

    const after = await paymentFor(booking.id)
    expect(after.amountRefunded).toBe(booking.total)
    expect(after.status).toBe("refunded")
  })

  it("charges the saved card when a guaranteed booking cancels late", async () => {
    const g = await guest()
    // One night out: inside the 48h deadline, so the 50% penalty applies.
    const token = await request(server())
      .post("/api/v1/properties/the-ritz-carlton/quote")
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({
        roomId: fx.deluxe.id,
        ratePlanId: fx.guarantee.id,
        checkIn: iso(1),
        checkOut: iso(3),
        adults: 2,
      })
      .expect(201)
    const created = await request(server())
      .post("/api/v1/bookings")
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .set("Idempotency-Key", `key-${++n}-${Math.random()}`)
      .send({
        quoteToken: token.body.quoteToken,
        guest: { firstName: "Amelia", lastName: "Hart", email: "amelia@example.com" },
      })
    expect(created.status).toBe(201)
    const booking = created.body.booking as { id: string; total: number }

    await start(g.cookie, booking.id).expect(201)
    const guaranteePayment = await paymentFor(booking.id)
    await authorized(guaranteePayment.providerRef!).expect(201)

    const res = await request(server())
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)

    // Nothing was ever taken, so the penalty is the only money that moves —
    // the opposite operation to the prepaid case, for the same policy.
    expect(res.body.settlement.action).toBe("charge_penalty")
    expect(res.body.settlement.amount).toBe(res.body.refund.charged)

    const rows = await db.select().from(payments).where(eq(payments.bookingId, booking.id))
    const penalty = rows.find((r) => r.kind === "penalty")
    expect(penalty).toBeDefined()
    expect(penalty!.status).toBe("captured")
    expect(penalty!.parentPaymentId).toBe(guaranteePayment.id)
  })

  it("never refunds more than was taken, however often it is asked", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await captured(payment.providerRef!, booking.total).expect(201)

    await request(server())
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)

    // A second cancel is refused by the state machine, but the ledger is what
    // has to hold if anything ever gets past it.
    await request(server())
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Again" })
      .expect(400)

    const after = await paymentFor(booking.id)
    expect(after.amountRefunded).toBe(booking.total)
  })

  /* ---------------------------------------------------------- no-show fee */

  it("charges the saved card for a no-show on a guaranteed rate (rules #9, #42)", async () => {
    const g = await guest()
    const booking = await bookOn(g.cookie, fx.guarantee.id, 1, 3)
    await start(g.cookie, booking.id).expect(201)
    const guaranteePayment = await paymentFor(booking.id)
    await authorized(guaranteePayment.providerRef!).expect(201)

    const desk = await partnerCookie("desk@aurora.test", "manager")
    const res = await request(server())
      .patch(`/api/v1/bookings/${booking.id}/status`)
      .set("Cookie", desk)
      .send({ status: "no_show" })
      .expect(200)

    // Rule #9 voids the commission — but the property still held the room all
    // night, and on a guarantee rate nobody has paid a cent yet.
    expect(res.body.settlement).toMatchObject({ action: "charge_penalty" })
    expect(res.body.settlement.amount).toBeGreaterThan(0)

    const rows = await db.select().from(payments).where(eq(payments.bookingId, booking.id))
    const penalty = rows.find((r) => r.kind === "penalty")
    expect(penalty?.status).toBe("captured")

    const [row] = await db.select().from(bookings).where(eq(bookings.id, booking.id))
    expect(row!.commissionStatus).toBe("void")
  })

  it("refunds a prepaid no-show whatever the property's own policy promises", async () => {
    const g = await guest()
    const booking = await bookOn(g.cookie, fx.prepay.id, 1, 3)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await captured(payment.providerRef!, booking.total).expect(201)

    const desk = await partnerCookie("desk@aurora.test", "manager")
    const res = await request(server())
      .patch(`/api/v1/bookings/${booking.id}/status`)
      .set("Cookie", desk)
      .send({ status: "no_show" })
      .expect(200)

    /*
     * A no-show is priced as a cancellation made at arrival — the latest
     * moment there is — and nothing more.
     *
     * This rate says 50% after the 48h deadline, so the property keeps 50% and
     * the rest goes back, even though the guest never appeared. That reads
     * generous until you notice the alternative: charging more than the
     * property's own published terms, for the one guest who cannot argue.
     *
     * A property that wants to keep the lot sells a `non_refundable` rate, or
     * one whose charge is `full`. The terms are theirs to set.
     */
    expect(res.body.settlement).toMatchObject({ action: "refund" })
    expect(res.body.settlement.amount).toBe(Math.round(booking.total / 2))

    // And no second charge: they already paid, so the money moves one way.
    const rows = await db.select().from(payments).where(eq(payments.bookingId, booking.id))
    expect(rows.filter((r) => r.kind === "penalty")).toHaveLength(0)
  })

  it("releases the authorization when a guaranteed booking is cancelled free", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.guarantee.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await authorized(payment.providerRef!).expect(201)

    await request(server())
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)

    // Left in place it sits on the guest's available balance for days after a
    // booking they no longer have.
    const after = await paymentFor(booking.id)
    expect(after.status).toBe("cancelled")
  })

  it("charges a no-show by the rate plan's OWN terms when it sets them (#47)", async () => {
    // The policy that could not be written down before: generous about
    // cancelling in time, strict about simply not turning up.
    const [strict] = await db
      .insert(ratePlans)
      .values({
        roomId: fx.deluxe.id,
        name: "Flexible, strict no-show",
        basePrice: 72_500,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        noShowCharge: "full",
        paymentMode: "guarantee",
      })
      .returning()

    const g = await guest()
    const booking = await bookOn(g.cookie, strict!.id, 1, 3)
    await start(g.cookie, booking.id).expect(201)
    const guaranteePayment = await paymentFor(booking.id)
    await authorized(guaranteePayment.providerRef!).expect(201)

    const desk = await partnerCookie("desk@aurora.test", "manager")
    const res = await request(server())
      .patch(`/api/v1/bookings/${booking.id}/status`)
      .set("Cookie", desk)
      .send({ status: "no_show" })
      .expect(200)

    // The WHOLE stay, not the 50% a late cancellation would have cost.
    expect(res.body.settlement).toMatchObject({
      action: "charge_penalty",
      amount: booking.total,
    })
  })

  it("still charges a cancellation at the cancellation rate on the same plan", async () => {
    const [strict] = await db
      .insert(ratePlans)
      .values({
        roomId: fx.deluxe.id,
        name: "Flexible, strict no-show",
        basePrice: 72_500,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        noShowCharge: "full",
        paymentMode: "guarantee",
      })
      .returning()

    const g = await guest()
    // Ten days out — comfortably inside the free window.
    const booking = await bookOn(g.cookie, strict!.id, 10, 3)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await authorized(payment.providerRef!).expect(201)

    const res = await request(server())
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)

    // Being strict about no-shows must not quietly shorten the free window.
    expect(res.body.refund.charged).toBe(0)
    expect(res.body.settlement).toMatchObject({ action: "none" })
  })

  it("freezes the no-show terms onto the booking (#47)", async () => {
    const [plan] = await db
      .insert(ratePlans)
      .values({
        roomId: fx.deluxe.id,
        name: "Lenient",
        basePrice: 72_500,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        paymentMode: "prepay",
      })
      .returning()

    const g = await guest()
    const booking = await bookOn(g.cookie, plan!.id, 1, 3)

    // The property turns strict AFTER the guest booked.
    await db.update(ratePlans).set({ noShowCharge: "full" }).where(eq(ratePlans.id, plan!.id))

    const [row] = await db.select().from(bookings).where(eq(bookings.id, booking.id))
    // A term nobody agreed to must not reach back into a stay already sold.
    expect(row!.noShowCharge).toBeNull()
  })

  it("tells the guest about the stricter term before they book (#47)", async () => {
    await db
      .insert(ratePlans)
      .values({
        roomId: fx.deluxe.id,
        name: "Strict no-show",
        basePrice: 72_500,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        noShowCharge: "full",
        paymentMode: "prepay",
      })

    const res = await request(server())
      .get("/api/v1/properties/the-ritz-carlton")
      .expect(200)

    const plan = res.body.rooms
      .flatMap((r: { ratePlans: { name: string; cancellationText: string }[] }) => r.ratePlans)
      .find((p: { name: string }) => p.name === "Strict no-show")

    /*
     * This sentence is the entire justification for allowing a property to be
     * stricter about no-shows. The guest reads it on the property page, before
     * they have paid anything. A charge that only appears afterwards would be
     * a different thing altogether.
     */
    expect(plan.cancellationText).toContain("Free cancellation until 48 hours")
    expect(plan.cancellationText).toContain("do not arrive")
    expect(plan.cancellationText).toContain("the full stay is charged")
  })

  /* ------------------------------------------------------------- job lock */

  it("runs the hold sweep on one instance only", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await db
      .update(bookings)
      .set({ holdExpiresAt: new Date(Date.now() - 60_000).toISOString() })
      .where(eq(bookings.id, booking.id))

    // Two instances, one advisory lock. The loser gets null and does nothing —
    // which is the normal outcome on every instance but one.
    const [a, b] = await Promise.all([jobs.sweepHolds(), jobs.sweepHolds()])
    void a
    void b

    const rows = await db.select().from(bookings).where(eq(bookings.id, booking.id))
    expect(rows[0]!.status).toBe("cancelled")

    const events = await db
      .select()
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, booking.id))
    // Created, then cancelled. Not cancelled twice.
    expect(events.filter((e) => e.toStatus === "cancelled")).toHaveLength(1)
  })

  /* ------------------------------------------------------- SECURITY GATE -- */

  it("refuses an anonymous attempt to start payment (API5)", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)

    await request(server())
      .post("/api/v1/payments/start")
      .set("x-forwarded-for", freshIp())
      .send({ bookingId: booking.id })
      .expect(401)
  })

  it("404s somebody else's booking — never 403 (API1)", async () => {
    const owner = await guest("owner@example.com")
    const stranger = await guest("stranger@example.com")
    const booking = await book(owner.cookie, fx.prepay.id)

    const res = await start(stranger.cookie, booking.id).expect(404)
    expect(res.body.message).toBe("Booking not found")
  })

  it("keeps one guest's ledger out of another's reach (API1)", async () => {
    const owner = await guest("owner@example.com")
    const stranger = await guest("stranger@example.com")
    const booking = await book(owner.cookie, fx.prepay.id)
    await start(owner.cookie, booking.id).expect(201)

    await request(server())
      .get(`/api/v1/payments/booking/${booking.id}`)
      .set("Cookie", stranger.cookie)
      .expect(404)

    const mine = await request(server())
      .get(`/api/v1/payments/booking/${booking.id}`)
      .set("Cookie", owner.cookie)
      .expect(200)
    expect(mine.body).toHaveLength(1)
  })

  it("never exposes the provider's handles on a card (API3)", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await captured(payment.providerRef!, booking.total).expect(201)

    const res = await request(server())
      .get(`/api/v1/payments/booking/${booking.id}`)
      .set("Cookie", g.cookie)
      .expect(200)

    // Anyone who collected these would hold the handles to a person's saved
    // cards at the processor.
    expect(res.body[0]).not.toHaveProperty("providerRef")
    expect(res.body[0]).not.toHaveProperty("providerMethodRef")
    expect(res.body[0]).not.toHaveProperty("provider")
    // The brand and last four are the whole of what a screen needs.
    expect(res.body[0]).toMatchObject({ cardBrand: "visa", cardLast4: "4242" })
  })

  it("refuses an amount, a mode or a currency from the client (API3)", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)

    // `.strict()` — the sum to charge comes from the booking, and a caller who
    // could name it could pay a dollar for a suite.
    for (const extra of [{ amount: 1 }, { mode: "guarantee" }, { currency: "PKR" }, { kind: "guarantee" }]) {
      await start(g.cookie, booking.id, extra).expect(400)
    }
  })

  it("refuses an absolute return URL, which would be an open redirect", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)

    // Mid-payment, from a page the guest trusts, to any host the caller likes.
    for (const returnPath of [
      "https://evil.test/steal",
      "//evil.test/steal",
      "http://evil.test",
      "evil.test",
    ]) {
      await start(g.cookie, booking.id, { returnPath }).expect(400)
    }

    await start(g.cookie, booking.id, { returnPath: "/checkout/done" }).expect(201)
  })

  it("refuses to start payment on a booking that is not awaiting one", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await captured(payment.providerRef!, booking.total).expect(201)

    const res = await start(g.cookie, booking.id).expect(400)
    expect(res.body.message).toContain("confirmed")
  })

  it("takes the payment mode from the rate plan, never the request (rule #42)", async () => {
    const g = await guest()
    const prepaid = await book(g.cookie, fx.prepay.id)
    const guaranteed = await book(g.cookie, fx.guarantee.id)

    const [a] = await db.select().from(bookings).where(eq(bookings.id, prepaid.id))
    const [b] = await db.select().from(bookings).where(eq(bookings.id, guaranteed.id))

    expect(a!.paymentMode).toBe("prepay")
    expect(b!.paymentMode).toBe("guarantee")
  })

  it("refuses a non-refundable rate that takes no money up front (rule #42)", async () => {
    // The rate that gives up the right to cancel is the one that must be paid
    // for. Enforced by the table, so no code path can talk its way around it.
    await expect(
      db.insert(ratePlans).values({
        roomId: fx.deluxe.id,
        name: "Non-refundable",
        basePrice: 62_000,
        cancelFreeUntil: "non_refundable",
        cancelCharge: "full",
        cancelChargeValue: null,
        paymentMode: "guarantee",
      })
    ).rejects.toThrow()
  })

  it("tells a PREPAID guest about their refund", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await captured(payment.providerRef!, booking.total).expect(201)
    await drainMail()

    await request(server())
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)
    await notifications.deliverDue()

    const message = mail.lastTo("amelia@example.com")!
    expect(message.text).toContain("refund")
    expect(message.text).toContain("$2,175.00")
  })

  it("🔴 tells a GUARANTEED guest they were CHARGED, not refunded", async () => {
    /*
     * The message used to report `refundFor().refund` to everybody.
     *
     * On a `guarantee` rate the guest paid nothing, so that figure describes a
     * refund which does not exist — while the guest is in fact being billed.
     * Every guaranteed cancellation told the guest the opposite of the truth.
     */
    const g = await guest()
    const booking = await bookOn(g.cookie, fx.guarantee.id, 1, 2)
    await start(g.cookie, booking.id).expect(201)
    const guaranteePayment = await paymentFor(booking.id)
    await authorized(guaranteePayment.providerRef!).expect(201)
    await drainMail()

    const res = await request(server())
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)
    expect(res.body.settlement.action).toBe("charge_penalty")
    await notifications.deliverDue()

    const message = mail.lastTo("amelia@example.com")!
    expect(message.text).toContain("cancellation charge")
    expect(message.text).not.toContain("refund")
  })

  it("says nothing moved when nothing did", async () => {
    const g = await guest()
    // Ten days out on a guaranteed rate: inside the free window, so there is
    // no penalty — and nothing was ever taken to give back.
    const booking = await book(g.cookie, fx.guarantee.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await authorized(payment.providerRef!).expect(201)
    await drainMail()

    await request(server())
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)
    await notifications.deliverDue()

    const message = mail.lastTo("amelia@example.com")!
    expect(message.text).toContain("Nothing has been charged")
  })

  /* ------------------------------------------- the property gets told too */

  it("🔴 tells the PROPERTY a room was sold", async () => {
    /*
     * The gap that mattered most: `partner_new_booking` was in the catalogue
     * and nothing ever fired it. A hotel that does not know a room was sold
     * cannot staff for it, cannot stop selling it elsewhere, and finds out
     * when somebody arrives at the desk.
     */
    const owner = await partnerCookie("owner@aurora.test", "admin")
    void owner

    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await drainMail()
    await captured(payment.providerRef!, booking.total).expect(201)
    await notifications.deliverDue()

    const message = mail.lastTo("owner@aurora.test")!
    expect(message.subject).toContain("New booking")
    expect(message.text).toContain("Deluxe King Room")
  })

  it("tells the property when a booking is cancelled, and what it keeps", async () => {
    await partnerCookie("owner@aurora.test", "admin")

    const g = await guest()
    // One night out on a guaranteed rate: inside the deadline, so the property
    // keeps the penalty — which is the figure they care about.
    const booking = await bookOn(g.cookie, fx.guarantee.id, 1, 2)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await authorized(payment.providerRef!).expect(201)
    await drainMail()

    await request(server())
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)
    await notifications.deliverDue()

    const message = mail.lastTo("owner@aurora.test")!
    expect(message.subject).toContain("Cancellation")
    expect(message.text).toContain("You keep")
  })

  it("sends the property one message per booking, not one per webhook", async () => {
    await partnerCookie("owner@aurora.test", "admin")
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await drainMail()

    // The provider redelivers. The booking is still confirmed once.
    await captured(payment.providerRef!, booking.total, "evt_dup_a").expect(201)
    await captured(payment.providerRef!, booking.total, "evt_dup_b").expect(201)
    await notifications.deliverDue()

    expect(mail.countTo("owner@aurora.test")).toBe(1)
  })

  it("🔴 queues the confirmation in the SAME transaction that confirms (rule #57)", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await captured(payment.providerRef!, booking.total).expect(201)

    /*
     * The proof: both rows carry the SAME transaction timestamp.
     *
     * `now()` in Postgres is the transaction's start time, not the statement's
     * — so two rows written in one transaction agree to the microsecond, and
     * two rows written in separate ones essentially never do.
     *
     * The claim in rule #57 was architectural before this: `notify(input, tx)`
     * existed and nothing passed a `tx`, so every message was queued after its
     * event had already committed. A process dying in that window left a
     * confirmed booking whose guest was never told, with nothing recording it.
     */
    const [event] = await db
      .select()
      .from(bookingEvents)
      .where(and(eq(bookingEvents.bookingId, booking.id), eq(bookingEvents.toStatus, "confirmed")))
    const queued = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.template, "booking_confirmed"))

    expect(event).toBeDefined()
    expect(queued).toHaveLength(1)
    expect(queued[0]!.createdAt).toBe(event!.createdAt)
  })

  it("queues the cancellation in the same transaction as the cancellation", async () => {
    const g = await guest()
    const booking = await book(g.cookie, fx.prepay.id)
    await start(g.cookie, booking.id).expect(201)
    const payment = await paymentFor(booking.id)
    await captured(payment.providerRef!, booking.total).expect(201)
    await db.delete(notificationOutbox)

    await request(server())
      .post(`/api/v1/bookings/${booking.id}/cancel`)
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ reason: "Plans changed" })
      .expect(201)

    const [event] = await db
      .select()
      .from(bookingEvents)
      .where(and(eq(bookingEvents.bookingId, booking.id), eq(bookingEvents.toStatus, "cancelled")))
    const [queued] = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.template, "booking_cancelled"))

    expect(queued!.createdAt).toBe(event!.createdAt)
  })
})
