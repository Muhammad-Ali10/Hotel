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
import { InvoicesService } from "../src/modules/finance/invoices.service"
import {
  auditLog,
  bookings,
  commissionInvoices,
  partnerMembers,
  partnerOrgs,
  properties,
  ratePlans,
  rooms,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"
const REASON = "Long-standing partner, finance approved invoice terms in writing."

/** Last month, which is what the run bills. */
function lastMonth() {
  const end = new Date()
  end.setUTCDate(0)
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1))
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  }
}

describe("commission invoices (rules #91–#95)", () => {
  let app: NestExpressApplication
  let db: Database
  let invoices: InvoicesService
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
    invoices = moduleRef.get(InvoicesService)
  })

  afterAll(async () => {
    await resetDb(db)
    await app?.close()
  })

  const server = () => app.getHttpServer()
  const freshIp = () => `198.51.100.${++n % 250}`

  let orgId: string
  let propertyId: string
  let roomId: string
  let ratePlanId: string

  async function account(email: string) {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "Dana", lastName: "Okafor" })
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

  const signIn = async (email: string) => {
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    return res.headers["set-cookie"] as unknown as string[]
  }

  async function admin() {
    const g = await account(`root${++n}@stayora.test`)
    await db.update(users).set({ role: "admin", platformRole: "super_admin" }).where(eq(users.id, g.id))
    return { cookie: await signIn(g.email), id: g.id, email: g.email }
  }

  async function partner() {
    const g = await account(`p${++n}@aurora.test`)
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, g.id))
    await db
      .insert(partnerMembers)
      .values({ orgId, userId: g.id, role: "admin", status: "active", propertyIds: [] })
    return { cookie: await signIn(g.email), id: g.id }
  }

  /** A completed stay whose commission is earned and billable. */
  async function billableBooking(over: { total?: number; checkOut?: string } = {}) {
    const period = lastMonth()
    const total = over.total ?? 100_000
    const [booking] = await db
      .insert(bookings)
      .values({
        ref: `STY-I${++n}${Date.now() % 10000}`,
        propertyId,
        roomId,
        ratePlanId,
        propertyName: "The Plaza",
        roomName: "Deluxe King Room",
        ratePlanName: "Flexible",
        city: "New York",
        cancelFreeUntil: "48h",
        cancelCharge: "full",
        guestFirstName: "A",
        guestLastName: "B",
        guestEmail: `g${n}@example.test`,
        checkIn: period.periodStart,
        checkOut: over.checkOut ?? period.periodEnd,
        adults: 2,
        pricing: {},
        total,
        paymentMode: "prepay",
        commissionRateBps: 2000,
        commissionAmount: Math.round(total * 0.2),
        commissionStatus: "earned",
        status: "completed",
      })
      .returning()
    return booking!
  }

  const setMode = (cookie: string[], mode: "deduct" | "invoice", reason = REASON) =>
    request(server())
      .post(`/api/v1/admin/invoices/orgs/${orgId}/mode`)
      .set("Cookie", cookie)
      .send({ mode, reason })

  const runMonth = (cookie: string[]) =>
    request(server())
      .post("/api/v1/admin/invoices/run")
      .set("Cookie", cookie)
      .send(lastMonth())

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

  /* ============================================================== the mode */

  describe("granting invoice terms (rules #91, #92)", () => {
    it("starts every partner on deduct — the platform holds what it is owed", async () => {
      const [org] = await db.select().from(partnerOrgs).where(eq(partnerOrgs.id, orgId))
      expect(org!.settlementMode).toBe("deduct")
    })

    it("lets the platform grant invoice terms, with a reason", async () => {
      const root = await admin()
      const res = await setMode(root.cookie, "invoice").expect(201)
      expect(res.body.settlementMode).toBe("invoice")
    })

    /* A decision about where the platform's money sits has to be answerable. */
    it("writes the decision to the audit log", async () => {
      const root = await admin()
      await setMode(root.cookie, "invoice").expect(201)

      const lines = await db.select().from(auditLog)
      expect(lines[0]).toMatchObject({
        action: "partner_org.settlement_mode",
        subjectType: "partner_org",
        subjectId: orgId,
        reason: REASON,
      })
      expect(lines[0]!.metadata).toMatchObject({ mode: "invoice" })
    })

    it("refuses a change with no reason", async () => {
      const root = await admin()
      await setMode(root.cookie, "invoice", "ok").expect(400)
    })

    /*
     * The partner cannot switch this on. It is the platform's side of the
     * agreement, like the commission rate itself (rule #59).
     */
    it("is not something a partner can grant themselves", async () => {
      const p = await partner()
      await setMode(p.cookie, "invoice").expect(403)
    })

    it("refuses invoice terms while something is outstanding", async () => {
      const root = await admin()
      await db.insert(commissionInvoices).values({
        ref: "INV-OLD",
        partnerOrgId: orgId,
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        grossAmount: 100_000,
        amount: 20_000,
        dueDate: "2026-02-14",
        status: "issued",
      })

      const res = await setMode(root.cookie, "invoice").expect(400)
      expect(res.body.message).toContain("unpaid invoices")
    })
  })

  /* =============================================================== the run */

  describe("the monthly run (rules #91, #94)", () => {
    it("bills an invoice org for the month", async () => {
      const root = await admin()
      await setMode(root.cookie, "invoice").expect(201)
      await billableBooking({ total: 100_000 })

      const res = await runMonth(root.cookie).expect(201)
      expect(res.body.issued).toBe(1)

      const [invoice] = await db.select().from(commissionInvoices)
      expect(invoice).toMatchObject({
        amount: 20_000,
        grossAmount: 100_000,
        bookingCount: 1,
        status: "issued",
      })
      expect(invoice!.ref).toMatch(/^INV-\d{4}-\d{2}-\d{6}$/)
    })

    /*
     * A `deduct` org has its commission taken from each payout. Invoicing them
     * as well would charge the same commission twice.
     */
    it("never bills a deduct org", async () => {
      const root = await admin()
      await billableBooking()

      const res = await runMonth(root.cookie).expect(201)
      expect(res.body.issued).toBe(0)
      expect(await db.select().from(commissionInvoices)).toHaveLength(0)
    })

    it("shows the working — every booking on its own line", async () => {
      const root = await admin()
      await setMode(root.cookie, "invoice").expect(201)
      const a = await billableBooking({ total: 100_000 })
      const b = await billableBooking({ total: 50_000 })

      await runMonth(root.cookie).expect(201)
      const [invoice] = await db.select().from(commissionInvoices)

      const detail = await request(server())
        .get(`/api/v1/admin/invoices/${invoice!.id}`)
        .set("Cookie", root.cookie)
        .expect(200)

      expect(detail.body.lines).toHaveLength(2)
      expect(detail.body.lines.map((l: { bookingRef: string }) => l.bookingRef).sort()).toEqual(
        [a.ref, b.ref].sort()
      )
      expect(detail.body.invoice.amount).toBe(30_000)
    })

    /*
     * The whole point of the unique index. A cron that fires twice, a retry,
     * or somebody running it by hand must not bill the same month again.
     */
    it("is safe to run twice", async () => {
      const root = await admin()
      await setMode(root.cookie, "invoice").expect(201)
      await billableBooking()

      await runMonth(root.cookie).expect(201)
      const second = await runMonth(root.cookie).expect(201)

      expect(second.body.issued).toBe(0)
      expect(await db.select().from(commissionInvoices)).toHaveLength(1)
    })

    /* A bill for nothing is noise a partner learns to ignore. */
    it("writes no invoice for a month with nothing in it", async () => {
      const root = await admin()
      await setMode(root.cookie, "invoice").expect(201)

      const res = await runMonth(root.cookie).expect(201)
      expect(res.body.issued).toBe(0)
    })

    /* A stay still in its hold, or one whose commission was voided on a
       goodwill refund (rule #76), is not money anybody owes. */
    it("bills only commission that was actually earned", async () => {
      const root = await admin()
      await setMode(root.cookie, "invoice").expect(201)
      const booking = await billableBooking()
      await db
        .update(bookings)
        .set({ commissionStatus: "void" })
        .where(eq(bookings.id, booking.id))

      const res = await runMonth(root.cookie).expect(201)
      expect(res.body.issued).toBe(0)
    })

    it("tells the partner they have a bill", async () => {
      const root = await admin()
      await setMode(root.cookie, "invoice").expect(201)
      await partner()
      await billableBooking()

      await runMonth(root.cookie).expect(201)

      const { sql } = await import("drizzle-orm")
      const queued = await db.execute<{ template: string }>(
        sql`SELECT template FROM notification_outbox WHERE template = 'invoice_issued'`
      )
      expect(queued.rows.length).toBeGreaterThan(0)
    })

    it("refuses a period that runs backwards", async () => {
      const root = await admin()
      await request(server())
        .post("/api/v1/admin/invoices/run")
        .set("Cookie", root.cookie)
        .send({ periodStart: "2026-08-31", periodEnd: "2026-08-01" })
        .expect(400)
    })
  })

  /* ============================================================== overdue */

  describe("an unpaid invoice (rule #95)", () => {
    const overdueInvoice = async () => {
      const [invoice] = await db
        .insert(commissionInvoices)
        .values({
          ref: `INV-OD-${++n}`,
          partnerOrgId: orgId,
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
          grossAmount: 100_000,
          amount: 20_000,
          // Long past.
          dueDate: "2026-02-14",
          status: "issued",
        })
        .returning()
      await db
        .update(partnerOrgs)
        .set({ settlementMode: "invoice" })
        .where(eq(partnerOrgs.id, orgId))
      return invoice!
    }

    it("takes the privilege back and stops the money", async () => {
      await overdueInvoice()
      const result = await invoices.sweepOverdue()

      expect(result.marked).toBe(1)
      const [org] = await db.select().from(partnerOrgs).where(eq(partnerOrgs.id, orgId))
      expect(org!.settlementMode).toBe("deduct")
      expect(org!.payoutsHeld).toBe(true)
    })

    /*
     * The guest booked and did nothing wrong. Pulling the listing punishes
     * them for the partner's unpaid bill.
     */
    it("leaves the listing on the market", async () => {
      await overdueInvoice()
      await invoices.sweepOverdue()

      const [property] = await db.select().from(properties).where(eq(properties.id, propertyId))
      expect(property!.status).toBe("active")

      // And a guest can still find it.
      const search = await request(server())
        .get("/api/v1/properties?city=New%20York")
        .expect(200)
      expect(search.body.items).toHaveLength(1)
    })

    it("leaves an invoice that is not yet due alone", async () => {
      const future = new Date()
      future.setUTCDate(future.getUTCDate() + 30)
      await db.insert(commissionInvoices).values({
        ref: `INV-F-${++n}`,
        partnerOrgId: orgId,
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        grossAmount: 100_000,
        amount: 20_000,
        dueDate: future.toISOString().slice(0, 10),
        status: "issued",
      })

      const result = await invoices.sweepOverdue()
      expect(result.marked).toBe(0)
    })

    it("is safe to sweep twice", async () => {
      await overdueInvoice()
      await invoices.sweepOverdue()
      const second = await invoices.sweepOverdue()
      expect(second.marked).toBe(0)
    })

    it("warns the partner what it costs", async () => {
      await partner()
      await overdueInvoice()
      await invoices.sweepOverdue()

      const { sql } = await import("drizzle-orm")
      const queued = await db.execute<{ template: string }>(
        sql`SELECT template FROM notification_outbox WHERE template = 'invoice_overdue'`
      )
      expect(queued.rows.length).toBeGreaterThan(0)
    })
  })

  /* ================================================================ paying */

  describe("settling an invoice", () => {
    /*
     * Each call bills a DIFFERENT month.
     *
     * `commission_invoices_period_unique` refuses two invoices for one org and
     * one period — which is what stops a re-run billing the same month twice,
     * and which caught this fixture the first time it tried to make two.
     */
    let month = 0
    const issued = async () => {
      month += 1
      const start = `2026-${String(month).padStart(2, "0")}-01`
      const [invoice] = await db
        .insert(commissionInvoices)
        .values({
          ref: `INV-P-${++n}`,
          partnerOrgId: orgId,
          periodStart: start,
          periodEnd: `2026-${String(month).padStart(2, "0")}-28`,
          grossAmount: 100_000,
          amount: 20_000,
          dueDate: "2026-02-14",
          status: "issued",
        })
        .returning()
      await db.update(partnerOrgs).set({ payoutsHeld: true }).where(eq(partnerOrgs.id, orgId))
      return invoice!
    }

    it("marks it paid and releases the money", async () => {
      const invoice = await issued()
      const root = await admin()

      const res = await request(server())
        .post(`/api/v1/admin/invoices/${invoice.id}/paid`)
        .set("Cookie", root.cookie)
        .send({ note: "Bank transfer received, ref 88213" })
        .expect(201)

      expect(res.body.status).toBe("paid")
      expect(res.body.paidAt).not.toBeNull()

      const [org] = await db.select().from(partnerOrgs).where(eq(partnerOrgs.id, orgId))
      expect(org!.payoutsHeld).toBe(false)
    })

    /*
     * Clearing one of three unpaid invoices must not release the money. The
     * hold is about the balance, not about any single document.
     */
    it("keeps the hold while anything is still outstanding", async () => {
      await issued()
      const second = await issued()
      const root = await admin()

      await request(server())
        .post(`/api/v1/admin/invoices/${second.id}/paid`)
        .set("Cookie", root.cookie)
        .send({ note: "Partial settlement, one invoice only" })
        .expect(201)

      const [org] = await db.select().from(partnerOrgs).where(eq(partnerOrgs.id, orgId))
      expect(org!.payoutsHeld).toBe(true)
    })

    it("refuses a payment with no note to reconcile against", async () => {
      const invoice = await issued()
      const root = await admin()
      await request(server())
        .post(`/api/v1/admin/invoices/${invoice.id}/paid`)
        .set("Cookie", root.cookie)
        .send({})
        .expect(400)
    })

    /* A partner cannot mark their own bill paid, for the same reason they
       cannot set their own commission (rule #59). */
    it("is not something a partner can do", async () => {
      const invoice = await issued()
      const p = await partner()
      await request(server())
        .post(`/api/v1/admin/invoices/${invoice.id}/paid`)
        .set("Cookie", p.cookie)
        .send({ note: "We have paid this ourselves, honestly" })
        .expect(403)
    })
  })

  /* =============================================================== reading */

  describe("who may see an invoice", () => {
    const issuedFor = async (targetOrgId: string) => {
      const [invoice] = await db
        .insert(commissionInvoices)
        .values({
          ref: `INV-R-${++n}`,
          partnerOrgId: targetOrgId,
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
          grossAmount: 100_000,
          amount: 20_000,
          dueDate: "2026-02-14",
        })
        .returning()
      return invoice!
    }

    it("shows a partner their own", async () => {
      const invoice = await issuedFor(orgId)
      const p = await partner()

      const list = await request(server())
        .get("/api/v1/partner/invoices")
        .set("Cookie", p.cookie)
        .expect(200)
      expect(list.body.map((i: { id: string }) => i.id)).toContain(invoice.id)
    })

    /* A 404, never a 403 — a 403 confirms the id belongs to somebody (API1). */
    it("is a 404 for another org's invoice", async () => {
      const [other] = await db
        .insert(partnerOrgs)
        .values({ name: "Rival", contactEmail: "r@rival.test" })
        .returning()
      const theirs = await issuedFor(other!.id)
      const p = await partner()

      await request(server())
        .get(`/api/v1/partner/invoices/${theirs.id}`)
        .set("Cookie", p.cookie)
        .expect(404)
    })

    it("keeps the platform's whole list away from a partner", async () => {
      const p = await partner()
      await request(server()).get("/api/v1/admin/invoices").set("Cookie", p.cookie).expect(403)
    })
  })
})
