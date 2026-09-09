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
  auditLog,
  bookings,
  notificationOutbox,
  partnerOrgs,
  payments,
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

describe("admin — reservations, users, audit", () => {
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
  const key = () => `admin-key-${++n}-${Date.now()}`

  let orgId: string
  let propertyId: string
  let roomId: string
  let ratePlanId: string

  async function account(email: string) {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "Amelia", lastName: "Hart" })
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

  async function admin(email = `root${++n}@stayora.test`) {
    const g = await account(email)
    await db.update(users).set({ role: "admin", platformRole: "super_admin" }).where(eq(users.id, g.id))
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    return { cookie: res.headers["set-cookie"] as unknown as string[], id: g.id, email }
  }

  /**
   * A confirmed, PREPAID booking with a REAL captured payment.
   *
   * Driven through quote → book → pay rather than seeded. A hand-written
   * payment row carries a `provider_ref` the fake provider has never heard of,
   * so every refund against it comes back as zero — the seeded version of this
   * helper failed nine tests for exactly that reason, and the failure was in
   * the fixture rather than the code.
   */
  async function seedBooking(over: { captured?: number; status?: string } = {}) {
    const g = await account(`guest${++n}@example.test`)

    const quote = await request(server())
      .post("/api/v1/properties/the-plaza/quote")
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .send({ roomId, ratePlanId, checkIn: iso(30), checkOut: iso(32), adults: 2 })
      .expect(201)

    const created = await request(server())
      .post("/api/v1/bookings")
      .set("Cookie", g.cookie)
      .set("x-forwarded-for", freshIp())
      .set("Idempotency-Key", key())
      .send({
        quoteToken: quote.body.quoteToken,
        guest: {
          firstName: "Amelia",
          lastName: "Hart",
          email: g.email,
          phone: "+1 212 555 0100",
          country: "USA",
        },
      })
      .expect(201)

    const bookingId = created.body.booking.id as string
    const total = created.body.booking.total as number

    if (over.captured !== 0) {
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
    }

    if (over.status) {
      await db.update(bookings).set({ status: over.status }).where(eq(bookings.id, bookingId))
    }

    return { bookingId, guestId: g.id, total, cookie: g.cookie }
  }

  beforeEach(async () => {
    await resetDb(db)
    const [org] = await db
      .insert(partnerOrgs)
      .values({ name: "Aurora", contactEmail: "hi@aurora.test", status: "active" })
      .returning()
    orgId = org!.id

    const [property] = await db
      .insert(properties)
      .values({
        slug: "the-plaza",
        name: "The Plaza",
        city: "New York",
        country: "USA",
        timezone: "UTC",
        checkInTime: "15:00",
        status: "active",
        partnerOrgId: orgId,
      })
      .returning()
    propertyId = property!.id

    const [room] = await db
      .insert(rooms)
      .values({
        propertyId,
        name: "Deluxe King Room",
        maxAdults: 2,
        maxChildren: 0,
        maxOccupancy: 2,
        units: 5,
      })
      .returning()
    roomId = room!.id

    const [plan] = await db
      .insert(ratePlans)
      .values({
        roomId,
        name: "Flexible",
        basePrice: 50_000,
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        isDefault: true,
      })
      .returning()
    ratePlanId = plan!.id
  })

  const refund = (cookie: string[], id: string, body: Record<string, unknown>, k = key()) =>
    request(server())
      .post(`/api/v1/admin/reservations/${id}/refund`)
      .set("Cookie", cookie)
      .set("Idempotency-Key", k)
      .send(body)

  /* ========================================================= reservations == */

  describe("finding a booking", () => {
    it("finds one by its reference, which is what a guest reads out", async () => {
      const { bookingId } = await seedBooking()
      const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId))
      const root = await admin()

      const res = await request(server())
        .get(`/api/v1/admin/reservations?q=${row!.ref}`)
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body.items).toHaveLength(1)
      expect(res.body.items[0].id).toBe(bookingId)
    })

    it("finds one by the guest's email", async () => {
      const { bookingId, guestId } = await seedBooking()
      const [guest] = await db.select().from(users).where(eq(users.id, guestId))
      const root = await admin()

      const res = await request(server())
        .get(`/api/v1/admin/reservations?q=${encodeURIComponent(guest!.email)}`)
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body.items[0].id).toBe(bookingId)
    })

    it("finds one by the guest's name, case-insensitively", async () => {
      await seedBooking()
      const root = await admin()

      const res = await request(server())
        .get("/api/v1/admin/reservations?q=AMELIA%20hart")
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body.items.length).toBeGreaterThan(0)
    })

    it("shows the money and the history on one booking", async () => {
      const { bookingId } = await seedBooking()
      const root = await admin()

      const res = await request(server())
        .get(`/api/v1/admin/reservations/${bookingId}`)
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body.totals.captured).toBeGreaterThan(0)
      expect(res.body.totals.refunded).toBe(0)
      expect(res.body.payments).toHaveLength(1)
    })

    it("keeps every route away from a partner and a guest", async () => {
      const { bookingId } = await seedBooking()
      const g = await account(`nosy${++n}@example.test`)

      await request(server())
        .get("/api/v1/admin/reservations")
        .set("Cookie", g.cookie)
        .expect(403)
      await request(server())
        .get(`/api/v1/admin/reservations/${bookingId}`)
        .set("Cookie", g.cookie)
        .expect(403)
      await request(server()).get("/api/v1/admin/audit").set("Cookie", g.cookie).expect(403)
      await request(server()).get("/api/v1/admin/users").set("Cookie", g.cookie).expect(403)
    })
  })

  /* =============================================================== refund == */

  describe("refunding (rules #76, #78)", () => {
    it("refunds what the guest was owed without touching the commission", async () => {
      // Booked 30 days out, so the 48h window has not closed: fully entitled.
      const { bookingId, total } = await seedBooking()
      const root = await admin()

      const res = await refund(root.cookie, bookingId, {
        amount: total,
        reason: "Guest cancelled within the free window, processed manually",
      }).expect(201)

      expect(res.body.refunded).toBe(total)
      expect(res.body.plan).toMatchObject({ goodwill: 0, voidsCommission: false })

      const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId))
      // UNTOUCHED, not "earned" — commission only becomes earned seven days
      // after checkout (rule #49), and a fresh booking is still `pending`.
      // What matters here is that an entitled refund did not void it.
      expect(row!.commissionStatus).not.toBe("void")
      expect(row!.refundStatus).toBe("full")
    })

    /*
     * The rule that costs the platform money on purpose. A property must not
     * lose out on a decision it was not part of and is not told about.
     */
    it("gives up the commission when any part is goodwill", async () => {
      const { bookingId, total } = await seedBooking()
      // Move the stay inside the window so only half is owed.
      await db
        .update(bookings)
        .set({ checkIn: iso(0), checkOut: iso(2) })
        .where(eq(bookings.id, bookingId))

      const root = await admin()
      const res = await refund(root.cookie, bookingId, {
        amount: total,
        reason: "Goodwill after a complaint about the room condition",
      }).expect(201)

      expect(res.body.plan.goodwill).toBeGreaterThan(0)
      expect(res.body.plan.voidsCommission).toBe(true)

      const [row] = await db.select().from(bookings).where(eq(bookings.id, bookingId))
      expect(row!.commissionStatus).toBe("void")
    })

    /*
     * The ceiling is what the LEDGER says was captured. On a guarantee rate
     * the guest may have paid the platform nothing at all, and measuring
     * against `bookings.total` would send out money that never came in.
     */
    it("refuses to refund a booking that never paid", async () => {
      const { bookingId } = await seedBooking({ captured: 0 })
      const root = await admin()

      const res = await refund(root.cookie, bookingId, {
        amount: 10_000,
        reason: "Trying to refund a booking that never paid anything",
      }).expect(400)

      expect(res.body.message).toContain("nothing to refund")
    })

    it("refuses more than is left", async () => {
      const { bookingId, total } = await seedBooking()
      const root = await admin()

      await refund(root.cookie, bookingId, {
        amount: total + 1,
        reason: "Attempting to refund more than the guest ever paid",
      }).expect(400)
    })

    it("refuses a second refund past what is left", async () => {
      const { bookingId } = await seedBooking()
      const root = await admin()

      await refund(root.cookie, bookingId, {
        amount: 60_000,
        reason: "First goodwill payment after the complaint",
      }).expect(201)

      await refund(root.cookie, bookingId, {
        amount: 60_000,
        reason: "Second payment, which would exceed what was captured",
      }).expect(400)
    })

    /*
     * The bug this module surfaced. Two DIFFERENT goodwill refunds of the same
     * amount used to derive the same provider key, so the second replayed the
     * first, reported success and sent nothing — while the ledger recorded it
     * twice. Pinned by `refund-idempotency.spec.ts` too.
     */
    it("sends two separate refunds of the same amount, and records both", async () => {
      const { bookingId } = await seedBooking()
      const root = await admin()

      await refund(root.cookie, bookingId, {
        amount: 10_000,
        reason: "First goodwill gesture for the delayed check-in",
      }).expect(201)

      await refund(root.cookie, bookingId, {
        amount: 10_000,
        reason: "Second gesture after the guest called again about the noise",
      }).expect(201)

      const res = await request(server())
        .get(`/api/v1/admin/reservations/${bookingId}`)
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body.totals.refunded).toBe(20_000)
    })

    it("replays a retried refund rather than sending a second", async () => {
      const { bookingId } = await seedBooking()
      const root = await admin()
      const sameKey = key()

      await refund(
        root.cookie,
        bookingId,
        { amount: 10_000, reason: "Goodwill for the late room change" },
        sameKey
      ).expect(201)

      await refund(
        root.cookie,
        bookingId,
        { amount: 10_000, reason: "Goodwill for the late room change" },
        sameKey
      ).expect(201)

      const res = await request(server())
        .get(`/api/v1/admin/reservations/${bookingId}`)
        .set("Cookie", root.cookie)
        .expect(200)

      // The provider replayed. Only one refund actually left.
      expect(res.body.totals.refunded).toBe(10_000)
    })

    it("requires an idempotency key at all", async () => {
      const { bookingId } = await seedBooking()
      const root = await admin()

      await request(server())
        .post(`/api/v1/admin/reservations/${bookingId}/refund`)
        .set("Cookie", root.cookie)
        .send({ amount: 10_000, reason: "No key on this request at all" })
        .expect(400)
    })

    /* "ok" is not a reason, and the record is the whole point (rule #78). */
    it("refuses a refund with no real reason", async () => {
      const { bookingId } = await seedBooking()
      const root = await admin()

      await refund(root.cookie, bookingId, { amount: 10_000 }).expect(400)
      await refund(root.cookie, bookingId, { amount: 10_000, reason: "ok" }).expect(400)
    })

    it("tells the guest their money is coming back", async () => {
      const { bookingId } = await seedBooking()
      const root = await admin()

      await refund(root.cookie, bookingId, {
        amount: 50_000,
        reason: "Partial goodwill after the maintenance disruption",
      }).expect(201)

      // The outbox, which nothing had ever put a `refund_issued` in before.
      const queued = await db
        .select()
        .from(notificationOutbox)
        .where(eq(notificationOutbox.template, "refund_issued"))
      expect(queued.length).toBeGreaterThan(0)
    })
  })

  /* =========================================================== transition == */

  describe("forcing a status (rule #78)", () => {
    it("moves a booking the platform is allowed to move", async () => {
      const { bookingId } = await seedBooking()
      const root = await admin()

      const res = await request(server())
        .post(`/api/v1/admin/reservations/${bookingId}/status`)
        .set("Cookie", root.cookie)
        .send({ to: "checked_in", reason: "Guest arrived, front desk system was down" })
        .expect(201)

      expect(res.body.booking.status).toBe("checked_in")
    })

    /*
     * Being an administrator says who is asking, not that the state machine is
     * optional. A completed stay cannot go back to pending (rule #6).
     */
    it("still refuses a transition the machine has no edge for", async () => {
      const { bookingId } = await seedBooking({ status: "completed" })
      const root = await admin()

      await request(server())
        .post(`/api/v1/admin/reservations/${bookingId}/status`)
        .set("Cookie", root.cookie)
        .send({ to: "confirmed", reason: "Trying to reopen a completed stay" })
        .expect(409)
    })

    it("refuses a forced status with no reason", async () => {
      const { bookingId } = await seedBooking()
      const root = await admin()

      await request(server())
        .post(`/api/v1/admin/reservations/${bookingId}/status`)
        .set("Cookie", root.cookie)
        .send({ to: "checked_in" })
        .expect(400)
    })
  })

  /* ================================================================ users == */

  describe("users (rules #79, #80, #81)", () => {
    it("shows a guest's history, and no password hash", async () => {
      const { guestId } = await seedBooking()
      const root = await admin()

      const res = await request(server())
        .get(`/api/v1/admin/users/${guestId}`)
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body.stats).toMatchObject({ bookings: 1 })
      expect(res.body.stats.spend).toBeGreaterThan(0)
      expect(res.body.bookings).toHaveLength(1)

      const body = JSON.stringify(res.body)
      expect(body).not.toContain("passwordHash")
      expect(body).not.toContain("password_hash")
    })

    /* A cancelled stay is not money the guest spent. */
    it("counts only realised bookings toward lifetime spend", async () => {
      const { guestId, bookingId } = await seedBooking()
      await db.update(bookings).set({ status: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: "guest" }).where(eq(bookings.id, bookingId))
      const root = await admin()

      const res = await request(server())
        .get(`/api/v1/admin/users/${guestId}`)
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body.stats).toMatchObject({ spend: 0, cancelled: 1 })
    })

    it("suspends an account", async () => {
      const g = await account(`bad${++n}@example.test`)
      const root = await admin()

      await request(server())
        .patch(`/api/v1/admin/users/${g.id}`)
        .set("Cookie", root.cookie)
        .send({ status: "suspended", reason: "Repeated chargebacks across four properties" })
        .expect(200)

      /*
       * 403, not 401 — and that is the right answer.
       *
       * The suspended check runs AFTER the password is verified, so a caller
       * with the wrong password still gets a bare 401 and learns nothing. Only
       * somebody who already knows the password is told the account is
       * suspended, and they knew it existed.
       */
      await request(server())
        .post("/api/v1/auth/login")
        .set("x-forwarded-for", freshIp())
        .send({ email: g.email, password: strong })
        .expect(403)
    })

    it("offers no way to delete a user (rule #79)", async () => {
      const g = await account(`keep${++n}@example.test`)
      const root = await admin()

      await request(server())
        .delete(`/api/v1/admin/users/${g.id}`)
        .set("Cookie", root.cookie)
        .expect(404)
    })

    /*
     * The same guard the org has one level down (rule #61) — except here there
     * is nobody above to undo it. A platform with no administrator has no way
     * back at all.
     */
    it("refuses to remove the last platform administrator", async () => {
      const root = await admin()

      await request(server())
        .patch(`/api/v1/admin/users/${root.id}`)
        .set("Cookie", root.cookie)
        .send({ role: "customer", reason: "Attempting to demote the only administrator" })
        .expect(409)

      await request(server())
        .patch(`/api/v1/admin/users/${root.id}`)
        .set("Cookie", root.cookie)
        .send({ status: "suspended", reason: "Attempting to suspend the only administrator" })
        .expect(409)
    })

    it("allows it once somebody else can take over", async () => {
      const first = await admin()
      const second = await admin()

      await request(server())
        .patch(`/api/v1/admin/users/${first.id}`)
        .set("Cookie", second.cookie)
        .send({ role: "customer", reason: "Handing the platform over before leaving" })
        .expect(200)
    })

    it("refuses a change with nothing in it", async () => {
      const g = await account(`x${++n}@example.test`)
      const root = await admin()

      await request(server())
        .patch(`/api/v1/admin/users/${g.id}`)
        .set("Cookie", root.cookie)
        .send({ reason: "A reason with no actual change attached to it" })
        .expect(400)
    })
  })

  /* ================================================================ audit == */

  describe("the audit log (rule #77)", () => {
    it("records a refund with who, why and how much", async () => {
      const { bookingId } = await seedBooking()
      const root = await admin()

      await refund(root.cookie, bookingId, {
        amount: 25_000,
        reason: "Goodwill for the broken air conditioning",
      }).expect(201)

      const res = await request(server())
        .get(`/api/v1/admin/audit?subjectType=booking&subjectId=${bookingId}`)
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body.items[0]).toMatchObject({
        action: "booking.refund",
        actorEmail: root.email,
        reason: "Goodwill for the broken air conditioning",
      })
      expect(res.body.items[0].metadata).toMatchObject({ amount: 25_000 })
    })

    it("records a forced transition and a suspension", async () => {
      const { bookingId } = await seedBooking()
      const g = await account(`s${++n}@example.test`)
      const root = await admin()

      await request(server())
        .post(`/api/v1/admin/reservations/${bookingId}/status`)
        .set("Cookie", root.cookie)
        .send({ to: "checked_in", reason: "Front desk system outage, checked in by phone" })
        .expect(201)

      await request(server())
        .patch(`/api/v1/admin/users/${g.id}`)
        .set("Cookie", root.cookie)
        .send({ status: "suspended", reason: "Abusive messages to three properties" })
        .expect(200)

      const res = await request(server())
        .get("/api/v1/admin/audit")
        .set("Cookie", root.cookie)
        .expect(200)

      const actions = res.body.items.map((r: { action: string }) => r.action)
      expect(actions).toContain("booking.force_status")
      expect(actions).toContain("user.suspend")
    })

    /*
     * The whole worth of this table. A log that can be tidied up after the
     * fact is not a log — and the guarantee is Postgres's, not the
     * application's, so no future code path can forget it.
     */
    it("cannot be edited or deleted, even from the database", async () => {
      const { bookingId } = await seedBooking()
      const root = await admin()
      await refund(root.cookie, bookingId, {
        amount: 10_000,
        reason: "Goodwill gesture that somebody may later want to hide",
      }).expect(201)

      const { sql } = await import("drizzle-orm")
      await db.execute(sql`UPDATE audit_log SET reason = 'tampered'`)
      await db.execute(sql`DELETE FROM audit_log`)

      const after = await db.select().from(auditLog)
      expect(after.length).toBeGreaterThan(0)
      expect(after.every((r) => r.reason !== "tampered")).toBe(true)
    })

    it("filters by who did it", async () => {
      const { bookingId } = await seedBooking()
      const a = await admin()
      const b = await admin()

      await request(server())
        .post(`/api/v1/admin/reservations/${bookingId}/status`)
        .set("Cookie", a.cookie)
        .send({ to: "checked_in", reason: "Checked in over the phone during the outage" })
        .expect(201)

      const mine = await request(server())
        .get(`/api/v1/admin/audit?actorId=${b.id}`)
        .set("Cookie", b.cookie)
        .expect(200)

      expect(mine.body.items).toHaveLength(0)
    })
  })

  /* ============================================================ analytics == */

  describe("platform analytics (rules #82–#84)", () => {
    const overview = (cookie: string[], extra = "") =>
      request(server())
        .get(`/api/v1/admin/analytics/overview?from=${iso(-1)}&to=${iso(1)}${extra}`)
        .set("Cookie", cookie)

    /*
     * The distinction the whole screen rests on. GMV is the guests' money and
     * mostly the property's; the platform earned the COMMISSION. Reporting one
     * as the other makes growth, margin and take rate all wrong at once.
     */
    it("keeps gross booking value and the platform's own revenue apart", async () => {
      const { total } = await seedBooking()
      const root = await admin()

      const res = await overview(root.cookie).expect(200)

      expect(res.body.gmv).toBe(total)
      // 15% of the stay, not the stay.
      expect(res.body.revenue).toBe(Math.round(total * 0.15))
      expect(res.body.revenue).toBeLessThan(res.body.gmv)
    })

    it("reports the take rate as commission over gross (rule #83)", async () => {
      await seedBooking()
      const root = await admin()

      const res = await overview(root.cookie).expect(200)
      expect(res.body.takeRate).toBeCloseTo(0.15, 4)
    })

    /*
     * Zero would read as "we charged nothing", which is a different and more
     * alarming statement than "nobody booked".
     */
    it("refuses to invent a take rate when nothing traded", async () => {
      const root = await admin()
      const res = await overview(root.cookie).expect(200)

      expect(res.body.gmv).toBe(0)
      expect(res.body.takeRate).toBeNull()
    })

    /* Voided commission is money the platform gave up (rule #76). */
    it("does not count commission it deliberately let go", async () => {
      const { bookingId, total } = await seedBooking()
      await db
        .update(bookings)
        .set({ checkIn: iso(0), checkOut: iso(2) })
        .where(eq(bookings.id, bookingId))

      const root = await admin()
      await refund(root.cookie, bookingId, {
        amount: total,
        reason: "Full goodwill refund after the property was unreachable",
      }).expect(201)

      const res = await overview(root.cookie).expect(200)
      expect(res.body.revenue).toBe(0)
    })

    it("says how much of the marketplace is actually live", async () => {
      const root = await admin()
      const res = await overview(root.cookie).expect(200)

      expect(res.body.shape).toMatchObject({ orgs: 1, activeOrgs: 1, liveProperties: 1 })
    })

    it("names the trend's two figures separately too", async () => {
      await seedBooking()
      const root = await admin()

      const res = await request(server())
        .get(`/api/v1/admin/analytics/sales?from=${iso(-1)}&to=${iso(1)}&granularity=day`)
        .set("Cookie", root.cookie)
        .expect(200)

      const point = res.body.points[0]
      expect(point.gmv).toBeGreaterThan(point.revenue)
    })

    /*
     * Ranked on commission, not GMV. A client sending large volume at a
     * negotiated low rate is worth less than the raw figure suggests, and a
     * list whose purpose is "who matters" must not put them at the top.
     */
    it("ranks clients by what they brought the platform", async () => {
      await seedBooking()
      const root = await admin()

      const res = await request(server())
        .get(`/api/v1/admin/analytics/clients?from=${iso(-1)}&to=${iso(1)}`)
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body[0]).toMatchObject({ orgName: "Aurora", bookings: 1, share: 1 })
      expect(res.body[0].revenue).toBeLessThan(res.body[0].gmv)
    })

    it("lists a client that has traded nothing rather than hiding it", async () => {
      await db
        .insert(partnerOrgs)
        .values({ name: "Quiet Group", contactEmail: "q@quiet.test", status: "active" })
      const root = await admin()

      const res = await request(server())
        .get(`/api/v1/admin/analytics/clients?from=${iso(-1)}&to=${iso(1)}`)
        .set("Cookie", root.cookie)
        .expect(200)

      expect(res.body.map((r: { orgName: string }) => r.orgName)).toContain("Quiet Group")
    })

    it("narrows to one client when asked", async () => {
      await seedBooking()
      const root = await admin()

      const mine = await overview(root.cookie, `&orgId=${orgId}`).expect(200)
      expect(mine.body.gmv).toBeGreaterThan(0)

      const [other] = await db
        .insert(partnerOrgs)
        .values({ name: "Elsewhere", contactEmail: "e@else.test" })
        .returning()
      const theirs = await overview(root.cookie, `&orgId=${other!.id}`).expect(200)
      expect(theirs.body.gmv).toBe(0)
    })

    it("still refuses a range longer than two years (API4)", async () => {
      const root = await admin()
      await request(server())
        .get("/api/v1/admin/analytics/overview?from=2024-01-01&to=2026-12-31")
        .set("Cookie", root.cookie)
        .expect(400)
      await request(server())
        .get("/api/v1/admin/analytics/clients?from=2024-01-01&to=2026-12-31")
        .set("Cookie", root.cookie)
        .expect(400)
    })

    it("keeps the whole marketplace away from a partner", async () => {
      const g = await account(`peek${++n}@example.test`)
      await overview(g.cookie).expect(403)
      await request(server())
        .get(`/api/v1/admin/analytics/clients?from=${iso(-1)}&to=${iso(1)}`)
        .set("Cookie", g.cookie)
        .expect(403)
    })
  })
})
