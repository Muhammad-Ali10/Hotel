import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { eq, sql } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { addDays } from "@stayora/shared"

import { AppModule } from "../src/app.module"
import { resetDb } from "./support/reset-db"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import { FinanceRepository } from "../src/modules/finance/finance.repository"
import { FinanceService } from "../src/modules/finance/finance.service"
import { FakePayoutProvider } from "../src/modules/finance/provider/fake-payout.provider"
import {
  bookings,
  notificationOutbox,
  partnerMembers,
  partnerOrgs,
  partnerPayoutAccounts,
  paymentEvents,
  payments,
  payoutItems,
  payouts,
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

/** $2,175 for three nights, 15% commission = $326.25. */
const TOTAL = 217_500
const COMMISSION = 32_625
const NET = TOTAL - COMMISSION

describe("finance", () => {
  let app: NestExpressApplication
  let db: Database
  let finance: FinanceService
  let payoutProvider: FakePayoutProvider
  let repo: FinanceRepository

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
    finance = moduleRef.get(FinanceService)
    payoutProvider = moduleRef.get(FakePayoutProvider)
    repo = moduleRef.get(FinanceRepository)
  })

  afterAll(async () => {
    await cleanup()
    await app?.close()
  })

  /**
   * The database AND the fake provider.
   *
   * The provider keeps what it was handed, so a test asserting "no transfer
   * was sent" counts every transfer the whole file has made unless this
   * resets too.
   */
  const cleanup = async () => {
    await resetDb(db)
    payoutProvider.reset()
  }

  const server = () => app.getHttpServer()
  let n = 0
  const freshIp = () => `198.18.0.${++n % 250}`

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

    const mkProperty = async (slug: string, orgId: string) => {
      const [property] = await db
        .insert(properties)
        .values({
          slug,
          name: slug,
          city: "New York",
          country: "USA",
          timezone: "America/New_York",
          checkInTime: "15:00",
          status: "active",
          basePrice: 72_500,
          partnerOrgId: orgId,
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
      return { property: property!, room: room!, plan: plan! }
    }

    const aurora = await mkProperty("the-ritz-carlton", org!.id)
    const other = await mkProperty("rival-hotel", rival!.id)

    return { org: org!, rival: rival!, aurora, other }
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

  async function partner(email: string, orgId = fx.org.id) {
    const g = await guest(email)
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, g.id))
    await db
      .insert(partnerMembers)
      .values({ orgId, userId: g.id, role: "admin", status: "active" })
    return g.cookie
  }

  async function admin(email = "root@stayora.test") {
    const g = await guest(email)
    await db.update(users).set({ role: "admin", platformRole: "super_admin" }).where(eq(users.id, g.id))
    return g.cookie
  }

  const verifiedAccount = (orgId = fx.org.id, status = "verified") =>
    db.insert(partnerPayoutAccounts).values({
      partnerOrgId: orgId,
      provider: "fake",
      providerAccountRef: `fake_acct_${orgId}`,
      holderName: "Aurora Hospitality",
      last4: "6789",
      status,
    })

  /**
   * A settled stay, written straight to the tables.
   *
   * The route from quote to payout runs through pricing, inventory, the
   * provider and three status transitions, and every one of them is already
   * covered by its own module's suite. What this module reads is narrower:
   * a booking's commission, and what the ledger says was collected against it.
   * Building those directly keeps the failures here about payout arithmetic.
   */
  async function stay(
    over: {
      orgProperty?: { property: { id: string }; room: { id: string }; plan: { id: string } }
      checkOut?: string
      commissionStatus?: string
      commissionAmount?: number
      total?: number
      /** What the platform actually captured. `0` models a guarantee rate. */
      captured?: number
      refunded?: number
      paymentMode?: string
      status?: string
    } = {}
  ) {
    const target = over.orgProperty ?? fx.aurora
    const checkOut = over.checkOut ?? iso(-10)
    const total = over.total ?? TOTAL
    const status = over.status ?? "completed"

    // Derived, not hardcoded: `bookings_dates_check` refuses a stay that ends
    // before it starts, and a fixture with a fixed check-in silently breaks
    // the moment a test asks for a different check-out.
    const checkIn = addDays(checkOut, -3)

    const [booking] = await db
      .insert(bookings)
      .values({
        ref: `STY-${String(++n).padStart(6, "0")}`,
        propertyId: target.property.id,
        roomId: target.room.id,
        ratePlanId: target.plan.id,
        propertyName: "Property",
        roomName: "Deluxe King Room",
        ratePlanName: "Flexible",
        guestFirstName: "Amelia",
        guestLastName: "Hart",
        guestEmail: "amelia@example.com",
        checkIn,
        checkOut,
        adults: 2,
        total,
        pricing: {
          nights: 3,
          nightlyRates: [72_500, 72_500, 72_500],
          ratePerNight: 72_500,
          roomSubtotal: total,
          addOnsTotal: 0,
          total,
        },
        cancelFreeUntil: "48h",
        cancelCharge: "percent",
        cancelChargeValue: 50,
        commissionRateBps: 1500,
        commissionAmount: over.commissionAmount ?? COMMISSION,
        commissionStatus: over.commissionStatus ?? "earned",
        paymentMode: over.paymentMode ?? "prepay",
        status,
        // A cancelled booking must carry its cancellation, or the table
        // refuses it — half-written cancellation data is how a refund gets
        // paid twice, or never.
        ...(status === "cancelled"
          ? { cancelledAt: new Date().toISOString(), cancelledBy: "guest" as const }
          : {}),
      })
      .returning()

    const captured = over.captured ?? total
    if (captured > 0) {
      await db.insert(payments).values({
        bookingId: booking!.id,
        kind: "charge",
        status: (over.refunded ?? 0) >= captured ? "refunded" : "captured",
        amount: captured,
        amountRefunded: over.refunded ?? 0,
        capturedAt: new Date().toISOString(),
        provider: "fake",
        providerRef: `fake_pi_${booking!.id}`,
      })
    } else {
      // A guarantee: the card was proved, nothing was taken.
      await db.insert(payments).values({
        bookingId: booking!.id,
        kind: "guarantee",
        status: "authorized",
        amount: 0,
        provider: "fake",
        providerRef: `fake_pi_${booking!.id}`,
      })
    }

    return booking!
  }

  const payoutFor = async (orgId = fx.org.id) => {
    const [row] = await db.select().from(payouts).where(eq(payouts.partnerOrgId, orgId))
    return row
  }

  beforeEach(async () => {
    await cleanup()
    fx = await seed()
  })

  /* ---------------------------------------------------------- the payout */

  it("collects every releasable booking, not the first five thousand", async () => {
    /*
     * The page size is 5 000, and it used to be a hard LIMIT with no cursor:
     * an organisation with more outstanding bookings than that had the
     * remainder silently left out of its payout. Nothing was lost — the next
     * run collected it — but "paid a fortnight late, for reasons nothing
     * records" is not something a finance report should be able to do.
     *
     * So the test has to cross the boundary for real. One statement, because
     * five thousand round trips would make this the slowest spec in the suite
     * and prove exactly the same thing.
     */
    const COUNT = 5_100
    const checkOut = iso(-10)
    const checkIn = addDays(checkOut, -3)

    await db.execute(sql`
      INSERT INTO bookings (
        ref, property_id, room_id, rate_plan_id,
        property_name, room_name, rate_plan_name, city,
        guest_first_name, guest_last_name, guest_email,
        check_in, check_out, adults, total, pricing,
        cancel_free_until, cancel_charge, cancel_charge_value,
        commission_rate_bps, commission_amount, commission_status,
        payment_mode, status
      )
      SELECT
        'STY-B' || LPAD(g::text, 6, '0'),
        ${fx.aurora.property.id}::uuid, ${fx.aurora.room.id}::uuid, ${fx.aurora.plan.id}::uuid,
        'Property', 'Deluxe King Room', 'Flexible', 'New York',
        'Amelia', 'Hart', 'amelia@example.com',
        ${checkIn}::date, ${checkOut}::date, 2, ${TOTAL},
        ${JSON.stringify({
          nights: 3,
          nightlyRates: [72_500, 72_500, 72_500],
          ratePerNight: 72_500,
          roomSubtotal: TOTAL,
          addOnsTotal: 0,
          total: TOTAL,
        })}::jsonb,
        '48h', 'percent', 50,
        1500, ${COMMISSION}, 'earned',
        'prepay', 'completed'
      FROM generate_series(1, ${COUNT}) AS g
    `)

    const releasable = await repo.releasableFor({
      orgId: fx.org.id,
      onOrBefore: iso(0),
    })

    // Every one of them, across three pages — not 5 000 and a silence.
    expect(releasable).toHaveLength(COUNT)
    // And each exactly once: a keyset without its tiebreak repeats rows at
    // every page boundary, and `check_out` here is one single date.
    expect(new Set(releasable.map((r) => r.bookingId)).size).toBe(COUNT)
  })

  it("pays a property what it collected, less commission (rules #9, #48)", async () => {
    await verifiedAccount()
    await stay()

    const result = await finance.runFor({ orgId: fx.org.id })

    expect(result).toMatchObject({
      grossAmount: TOTAL,
      commissionAmount: COMMISSION,
      netAmount: NET,
      direction: "payout",
      status: "paid",
    })
    expect(result!.paidAt).toBeTruthy()
  })

  it("breaks the figure down to the stays behind it", async () => {
    await verifiedAccount()
    const a = await stay()
    const b = await stay()

    const payout = await finance.runFor({ orgId: fx.org.id })
    const items = await db.select().from(payoutItems).where(eq(payoutItems.payoutId, payout!.id))

    // "Why is this figure $369,750" is a question a property will ask.
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.bookingId).sort()).toEqual([a.id, b.id].sort())
    expect(items.every((i) => i.netAmount === NET)).toBe(true)
    expect(payout!.netAmount).toBe(NET * 2)
  })

  it("invoices a property whose guests all paid at the desk (rule #52)", async () => {
    await verifiedAccount()
    // A guarantee rate: the guest settled at the property, so the platform
    // collected nothing — and the stay happened, so commission is still owed.
    await stay({ captured: 0, paymentMode: "guarantee" })

    const result = await finance.runFor({ orgId: fx.org.id })

    expect(result).toMatchObject({
      grossAmount: 0,
      commissionAmount: COMMISSION,
      netAmount: -COMMISSION,
      direction: "invoice",
    })
    // Nothing is transferred on an invoice — the money flows the other way.
    expect(payoutProvider.transferCount).toBe(0)
  })

  it("nets both modes against each other in one cycle", async () => {
    await verifiedAccount()
    await stay()
    await stay({ captured: 0, paymentMode: "guarantee" })

    const result = await finance.runFor({ orgId: fx.org.id })

    // The ordinary case for a real property: some rates prepaid, some
    // guaranteed. One balance, one transfer.
    expect(result!.netAmount).toBe(NET - COMMISSION)
    expect(result!.direction).toBe("payout")
  })

  it("gives the property the whole cancellation penalty (rule #9)", async () => {
    await verifiedAccount()
    // Cancelled late: the platform kept a penalty, and earned no commission on
    // a stay that never happened. All of it is the property's.
    await stay({
      status: "cancelled",
      commissionStatus: "void",
      captured: TOTAL,
      refunded: 108_750,
    })

    const result = await finance.runFor({ orgId: fx.org.id })

    expect(result).toMatchObject({
      grossAmount: 108_750,
      commissionAmount: 0,
      netAmount: 108_750,
      direction: "payout",
    })
  })

  /* ---------------------------------------------------------- the hold */

  it("holds a stay for seven days after checkout (rule #49)", async () => {
    await verifiedAccount()
    await stay({ checkOut: iso(-3) })

    // A dispute raised the week after checkout is ordinary, and money already
    // wired out is money nobody gets back.
    expect(await finance.runFor({ orgId: fx.org.id })).toBeNull()
  })

  it("releases it on the seventh day", async () => {
    await verifiedAccount()
    await stay({ checkOut: iso(-7) })
    expect(await finance.runFor({ orgId: fx.org.id })).not.toBeNull()
  })

  it("waits for a stay whose outcome is still unknown", async () => {
    await verifiedAccount()
    // Checked in but not yet completed: nobody knows what was earned.
    await stay({ checkOut: iso(-20), commissionStatus: "pending", status: "checked_in" })

    expect(await finance.runFor({ orgId: fx.org.id })).toBeNull()
  })

  /* --------------------------------------------------- minimum and carry */

  it("carries a balance too small to be worth the fee (rule #50)", async () => {
    await verifiedAccount()
    await stay({ total: 5_000, commissionAmount: 750, captured: 5_000 })

    const result = await finance.runFor({ orgId: fx.org.id })

    expect(result).toMatchObject({ netAmount: 4_250, direction: "carry", status: "pending" })
    // A $3 fee on a $42 transfer is money thrown away.
    expect(payoutProvider.transferCount).toBe(0)
  })

  it("accumulates the carried balance until it is worth paying", async () => {
    await verifiedAccount()

    // Three cycles of a small balance. Without carry-in, a property earning
    // $42 a fortnight would carry forever and never once be paid.
    await stay({ total: 5_000, commissionAmount: 750, captured: 5_000 })
    const first = await finance.runFor({ orgId: fx.org.id, today: "2026-09-16" })
    expect(first).toMatchObject({ netAmount: 4_250, direction: "carry" })

    await stay({ total: 5_000, commissionAmount: 750, captured: 5_000 })
    const second = await finance.runFor({ orgId: fx.org.id, today: "2026-10-01" })
    expect(second).toMatchObject({ netAmount: 8_500, direction: "carry" })

    await stay({ total: 5_000, commissionAmount: 750, captured: 5_000 })
    const third = await finance.runFor({ orgId: fx.org.id, today: "2026-10-16" })
    expect(third).toMatchObject({ netAmount: 12_750, direction: "payout", status: "paid" })
  })

  it("carries an unpaid invoice into the next cycle", async () => {
    await verifiedAccount()
    await stay({ captured: 0, paymentMode: "guarantee" })
    const invoice = await finance.runFor({ orgId: fx.org.id, today: "2026-09-16" })
    expect(invoice!.netAmount).toBe(-COMMISSION)

    await stay()
    const next = await finance.runFor({ orgId: fx.org.id, today: "2026-10-01" })

    // Commercially the only sane answer: what they owe is netted against what
    // they are owed, rather than wiped by one good fortnight.
    expect(next!.carryIn).toBe(-COMMISSION)
    expect(next!.netAmount).toBe(NET - COMMISSION)
  })

  it("does nothing at all for a property with no activity", async () => {
    await verifiedAccount()
    // An empty settlement would take the period number and block the real one.
    expect(await finance.runFor({ orgId: fx.org.id })).toBeNull()
    expect(await db.select().from(payouts)).toHaveLength(0)
  })

  /* ------------------------------------------------------- paid once, ever */

  it("never pays the same booking twice, however often the run fires", async () => {
    await verifiedAccount()
    await stay()

    const first = await finance.runFor({ orgId: fx.org.id, today: "2026-09-16" })
    expect(first!.netAmount).toBe(NET)

    // A retry, two instances, a manual re-run — the same period again.
    const second = await finance.runFor({ orgId: fx.org.id, today: "2026-09-16" })
    expect(second).toBeNull()

    // And a LATER period, which is the case a unique-per-period key alone
    // would not catch: the stay is already settled, so there is nothing left.
    const later = await finance.runFor({ orgId: fx.org.id, today: "2026-10-01" })
    expect(later).toBeNull()

    expect(await db.select().from(payouts)).toHaveLength(1)
    expect(await db.select().from(payoutItems)).toHaveLength(1)
    expect(payoutProvider.transferCount).toBe(1)
  })

  it("settles once when two runs fire together", async () => {
    await verifiedAccount()
    await stay()

    const [a, b] = await Promise.all([
      finance.runFor({ orgId: fx.org.id, today: "2026-09-16" }),
      finance.runFor({ orgId: fx.org.id, today: "2026-09-16" }),
    ])

    expect([a, b].filter(Boolean)).toHaveLength(1)
    expect(await db.select().from(payoutItems)).toHaveLength(1)
  })

  it("refuses a second settlement of the same booking at the table", async () => {
    await verifiedAccount()
    const booking = await stay()
    const payout = await finance.runFor({ orgId: fx.org.id })

    // The single most important constraint in this module.
    await expect(
      db.insert(payoutItems).values({
        payoutId: payout!.id,
        bookingId: booking.id,
        grossAmount: 1,
        commissionAmount: 0,
        netAmount: 1,
      })
    ).rejects.toThrow()
  })

  /* ------------------------------------------------------ transfer safety */

  it("sends nothing to an account nobody verified", async () => {
    await verifiedAccount(fx.org.id, "unverified")
    await stay()

    const result = await finance.runFor({ orgId: fx.org.id })

    // An unverified account is a string somebody typed into a form. A transfer
    // against it lands in a stranger's bank and cannot be recalled.
    expect(result).toMatchObject({ status: "failed", netAmount: NET })
    expect(result!.failureReason).toContain("verified")
    expect(payoutProvider.transferCount).toBe(0)
  })

  it("sends nothing when there is no account at all", async () => {
    await stay()
    const result = await finance.runFor({ orgId: fx.org.id })

    expect(result).toMatchObject({ status: "failed" })
    expect(result!.failureReason).toContain("No payout account")
  })

  it("keeps the settlement intact when the bank rejects the transfer", async () => {
    await verifiedAccount()
    // The fake rejects an amount ending in 01.
    await stay({ total: 10_101, commissionAmount: 0, captured: 10_101, commissionStatus: "void" })

    const result = await finance.runFor({ orgId: fx.org.id })

    expect(result).toMatchObject({ status: "failed", netAmount: 10_101 })
    // The lines survive: the stays are recorded as settled, so a retry moves
    // money without recounting a single one of them.
    expect(await db.select().from(payoutItems)).toHaveLength(1)
  })

  it("retries only the transfer, never the arithmetic", async () => {
    await verifiedAccount(fx.org.id, "unverified")
    await stay()
    const failed = await finance.runFor({ orgId: fx.org.id })
    expect(failed!.status).toBe("failed")

    await db
      .update(partnerPayoutAccounts)
      .set({ status: "verified" })
      .where(eq(partnerPayoutAccounts.partnerOrgId, fx.org.id))

    const retried = await finance.retry(failed!.id)

    expect(retried).toMatchObject({ status: "paid", netAmount: NET })
    // Same settlement, same lines, same figure.
    expect(retried!.id).toBe(failed!.id)
    expect(await db.select().from(payoutItems)).toHaveLength(1)
  })

  it("sends one transfer even if a retry races itself", async () => {
    await verifiedAccount(fx.org.id, "unverified")
    await stay()
    const failed = await finance.runFor({ orgId: fx.org.id })
    await db
      .update(partnerPayoutAccounts)
      .set({ status: "verified" })
      .where(eq(partnerPayoutAccounts.partnerOrgId, fx.org.id))

    const results = await Promise.allSettled([
      finance.retry(failed!.id),
      finance.retry(failed!.id),
    ])

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    // And even if both had got through, the idempotency key would collapse
    // them into one transfer at the provider.
    expect(payoutProvider.transferCount).toBe(1)
  })

  it("carries on with the other properties when one fails", async () => {
    await verifiedAccount(fx.org.id)
    await verifiedAccount(fx.rival.id)
    await stay()
    await stay({ orgProperty: fx.other, commissionAmount: 26_100 })

    const result = await finance.runAll()

    // A run that aborts halfway leaves half the properties unpaid, and no
    // record of which half.
    expect(result.settled).toBe(2)
    expect(result.paid).toBe(2)
  })

  /* --------------------------------------------------------------- reads */

  it("shows a partner their own settlements", async () => {
    await verifiedAccount()
    await stay()
    await finance.runFor({ orgId: fx.org.id })

    const cookie = await partner("boss@aurora.test")
    const res = await request(server())
      .get("/api/v1/partner/payouts")
      .set("Cookie", cookie)
      .expect(200)

    expect(res.body).toHaveLength(1)
    expect(res.body[0]).toMatchObject({ net: NET, direction: "payout", status: "paid" })
  })

  it("shows the statement behind a settlement", async () => {
    await verifiedAccount()
    const booking = await stay()
    const payout = await finance.runFor({ orgId: fx.org.id })
    const cookie = await partner("boss@aurora.test")

    const res = await request(server())
      .get(`/api/v1/partner/payouts/${payout!.id}`)
      .set("Cookie", cookie)
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({
      bookingId: booking.id,
      ref: booking.ref,
      gross: TOTAL,
      commission: COMMISSION,
      net: NET,
    })
  })

  /* ------------------------------------------------------- payout account */

  it("lands a new payout account unverified, whoever sets it", async () => {
    const cookie = await partner("boss@aurora.test")

    const res = await request(server())
      .post("/api/v1/partner/payouts/account")
      .set("Cookie", cookie)
      .send({
        providerAccountRef: "fake_acct_new",
        holderName: "Aurora Hospitality",
        last4: "6789",
        bankName: "Meezan",
      })
      .expect(201)

    // Re-pointing a payout account is how a compromised partner login turns
    // into a bank transfer. It always costs the org its verified status.
    expect(res.body).toMatchObject({ last4: "6789", status: "unverified" })
  })

  it("un-verifies an account the moment it is re-pointed", async () => {
    await verifiedAccount()
    const cookie = await partner("boss@aurora.test")

    await request(server())
      .post("/api/v1/partner/payouts/account")
      .set("Cookie", cookie)
      .send({ providerAccountRef: "fake_acct_attacker", holderName: "Someone Else", last4: "0000" })
      .expect(201)

    // And the next run sends nothing, which is the whole point.
    await stay()
    const result = await finance.runFor({ orgId: fx.org.id })
    expect(result).toMatchObject({ status: "failed" })
    expect(payoutProvider.transferCount).toBe(0)
  })

  it("refuses a manager and staff the payout account (rule #14)", async () => {
    const g = await guest("mgr@aurora.test")
    await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, g.id))
    await db
      .insert(partnerMembers)
      .values({ orgId: fx.org.id, userId: g.id, role: "manager", status: "active" })

    await request(server())
      .post("/api/v1/partner/payouts/account")
      .set("Cookie", g.cookie)
      .send({ providerAccountRef: "fake_acct_x", holderName: "Manager Move", last4: "1111" })
      .expect(403)
  })

  it("never hands back the provider's handle on a bank account (API3)", async () => {
    await verifiedAccount()
    const cookie = await partner("boss@aurora.test")

    const res = await request(server())
      .get("/api/v1/partner/payouts/account")
      .set("Cookie", cookie)
      .expect(200)

    expect(res.body).toMatchObject({ last4: "6789", status: "verified" })
    expect(res.body).not.toHaveProperty("providerAccountRef")
  })

  it("refuses anything but four digits for the display last4", async () => {
    const cookie = await partner("boss@aurora.test")
    for (const last4 of ["12345678901234567890", "abcd", "12", ""]) {
      await request(server())
        .post("/api/v1/partner/payouts/account")
        .set("Cookie", cookie)
        .send({ providerAccountRef: "fake_acct_x", holderName: "Aurora", last4 })
        .expect(400)
    }
  })

  it("lets only an admin make an account payable", async () => {
    const cookie = await partner("boss@aurora.test")
    await request(server())
      .post("/api/v1/partner/payouts/account")
      .set("Cookie", cookie)
      .send({ providerAccountRef: "fake_acct_new", holderName: "Aurora", last4: "6789" })
      .expect(201)

    const root = await admin()
    const res = await request(server())
      .post(`/api/v1/admin/payouts/accounts/${fx.org.id}/verify`)
      .set("Cookie", root)
      .send({ verified: true })
      .expect(201)
    expect(res.body.status).toBe("verified")

    await stay()
    expect(await finance.runFor({ orgId: fx.org.id })).toMatchObject({ status: "paid" })
  })

  it("refuses a partner the verify button (API5)", async () => {
    const cookie = await partner("boss@aurora.test")
    await request(server())
      .post(`/api/v1/admin/payouts/accounts/${fx.org.id}/verify`)
      .set("Cookie", cookie)
      .send({ verified: true })
      .expect(403)
  })

  it("is safe to press the manual run twice (API6)", async () => {
    await verifiedAccount()
    await stay()
    const root = await admin()

    await request(server()).post("/api/v1/admin/payouts/run").set("Cookie", root).expect(201)
    await request(server()).post("/api/v1/admin/payouts/run").set("Cookie", root).expect(201)

    // One settlement, one line, one transfer — the constraints decide, not the
    // caller's restraint.
    expect(await db.select().from(payouts)).toHaveLength(1)
    expect(await db.select().from(payoutItems)).toHaveLength(1)
    expect(payoutProvider.transferCount).toBe(1)
  })

  it("refuses a partner the manual run (API5)", async () => {
    const cookie = await partner("boss@aurora.test")
    await request(server()).post("/api/v1/admin/payouts/run").set("Cookie", cookie).expect(403)
  })

  /* ------------------------------------------------------- SECURITY GATE -- */

  it("refuses an anonymous caller (API5)", async () => {
    await request(server()).get("/api/v1/partner/payouts").expect(401)
    await request(server()).get("/api/v1/admin/payouts").expect(401)
  })

  it("refuses a guest and a partner the admin ledger (API5)", async () => {
    const g = await guest()
    const cookie = await partner("boss@aurora.test")

    await request(server()).get("/api/v1/admin/payouts").set("Cookie", g.cookie).expect(403)
    await request(server()).get("/api/v1/admin/payouts").set("Cookie", cookie).expect(403)
  })

  it("refuses a guest the partner ledger (API5)", async () => {
    const g = await guest()
    await request(server()).get("/api/v1/partner/payouts").set("Cookie", g.cookie).expect(403)
  })

  it("keeps a rival's revenue out of a partner's list (API1)", async () => {
    await verifiedAccount(fx.rival.id)
    await stay({ orgProperty: fx.other })
    await finance.runFor({ orgId: fx.rival.id })

    const cookie = await partner("boss@aurora.test")
    const res = await request(server())
      .get("/api/v1/partner/payouts")
      .set("Cookie", cookie)
      .expect(200)

    // A competitor's fortnightly revenue is exactly the figure they would most
    // like to see.
    expect(res.body).toHaveLength(0)
  })

  it("404s a rival's statement — never 403 (API1)", async () => {
    await verifiedAccount(fx.rival.id)
    await stay({ orgProperty: fx.other })
    const theirs = await finance.runFor({ orgId: fx.rival.id })

    const cookie = await partner("boss@aurora.test")
    const res = await request(server())
      .get(`/api/v1/partner/payouts/${theirs!.id}`)
      .set("Cookie", cookie)
      .expect(404)

    // A 403 would confirm the payout id is real.
    expect(res.body.message).toBe("Payout not found")
  })

  it("refuses a partner the retry button (API5)", async () => {
    await verifiedAccount(fx.org.id, "unverified")
    await stay()
    const failed = await finance.runFor({ orgId: fx.org.id })
    const cookie = await partner("boss@aurora.test")

    await request(server())
      .post(`/api/v1/admin/payouts/${failed!.id}/retry`)
      .set("Cookie", cookie)
      .expect(403)
  })

  it("refuses to retry a settlement that already paid", async () => {
    await verifiedAccount()
    await stay()
    const paid = await finance.runFor({ orgId: fx.org.id })
    const root = await admin()

    // The one that would send the money a second time.
    await request(server())
      .post(`/api/v1/admin/payouts/${paid!.id}/retry`)
      .set("Cookie", root)
      .expect(403)
  })

  it("never exposes the provider's transfer handle (API3)", async () => {
    await verifiedAccount()
    await stay()
    await finance.runFor({ orgId: fx.org.id })
    const cookie = await partner("boss@aurora.test")

    const res = await request(server())
      .get("/api/v1/partner/payouts")
      .set("Cookie", cookie)
      .expect(200)

    expect(res.body[0]).not.toHaveProperty("providerRef")
    expect(res.body[0]).not.toHaveProperty("partnerOrgId")
  })

  it("caps the page size (API4)", async () => {
    const cookie = await partner("boss@aurora.test")
    await request(server())
      .get("/api/v1/partner/payouts?limit=5000")
      .set("Cookie", cookie)
      .expect(400)
  })

  it("keeps the arithmetic honest at the table (rules #48–#52)", async () => {
    // The database refuses a settlement whose total does not follow from its
    // own parts. The moment one exists, nobody can tell which of the four
    // numbers is the wrong one.
    await expect(
      db.insert(payouts).values({
        partnerOrgId: fx.org.id,
        periodStart: "2026-09-01",
        periodEnd: "2026-09-15",
        grossAmount: TOTAL,
        commissionAmount: COMMISSION,
        carryIn: 0,
        netAmount: 999_999,
        direction: "payout",
      })
    ).rejects.toThrow()

    // And a direction that disagrees with the sign it claims to describe.
    await expect(
      db.insert(payouts).values({
        partnerOrgId: fx.org.id,
        periodStart: "2026-10-01",
        periodEnd: "2026-10-15",
        grossAmount: 0,
        commissionAmount: COMMISSION,
        carryIn: 0,
        netAmount: -COMMISSION,
        direction: "payout",
      })
    ).rejects.toThrow()
  })

  /* ============================================ the reports (rule #97) == */

  describe("finance reports", () => {
    /** The window every report in this block counts on. */
    const window = { from: iso(-30), to: iso(1) }

    const partnerGet = (path: string, cookie: string[], query: object = {}) =>
      request(server())
        .get(`/api/v1/partner/finance/${path}`)
        .set("Cookie", cookie)
        .query({ ...window, ...query })

    const adminGet = (path: string, cookie: string[], query: object = {}) =>
      request(server())
        .get(`/api/v1/admin/finance/${path}`)
        .set("Cookie", cookie)
        .query({ ...window, ...query })

    it("splits the money three ways, and never calls two of them the same thing", async () => {
      await stay()
      const cookie = await partner("fin1@aurora.test")

      const res = await partnerGet("overview", cookie).expect(200)

      expect(res.body).toMatchObject({
        bookings: 1,
        gross: TOTAL,
        commission: COMMISSION,
        net: NET,
      })
      // The three add up. A report where they do not is one nobody can
      // reconcile against an invoice.
      expect(res.body.gross - res.body.commission).toBe(res.body.net)
      expect(res.body.effectiveRateBps).toBe(1500)
    })

    it("leaves out commission the platform gave up (rule #76)", async () => {
      await stay()
      await stay({ commissionStatus: "void" })
      const cookie = await partner("fin2@aurora.test")

      const res = await partnerGet("overview", cookie).expect(200)

      // Both stays are gross; only one still owes commission. Counting the
      // voided one bills the partner for a goodwill gesture.
      expect(res.body.gross).toBe(TOTAL * 2)
      expect(res.body.commission).toBe(COMMISSION)
      expect(res.body.net).toBe(TOTAL * 2 - COMMISSION)
    })

    it("shows what is owed each way without netting the two together", async () => {
      await stay()
      await verifiedAccount()
      await db.insert(payouts).values({
        partnerOrgId: fx.org.id,
        periodStart: iso(-15),
        periodEnd: iso(-1),
        grossAmount: TOTAL,
        commissionAmount: COMMISSION,
        carryIn: 0,
        netAmount: NET,
        direction: "payout",
        status: "pending",
      })
      const cookie = await partner("fin3@aurora.test")

      const res = await partnerGet("overview", cookie).expect(200)

      // One is what the platform owes the partner, the other what the partner
      // owes the platform. A single figure hides which way it is going.
      expect(res.body.pendingPayouts).toMatchObject({ amount: NET, count: 1 })
      expect(res.body.outstandingInvoices).toMatchObject({ amount: 0, count: 0 })
      expect(res.body.settlementMode).toBe("deduct")
    })

    it("never counts another organisation's money", async () => {
      await stay()
      await stay({ orgProperty: fx.other })
      const cookie = await partner("fin4@aurora.test")

      const res = await partnerGet("overview", cookie).expect(200)
      expect(res.body.bookings).toBe(1)
      expect(res.body.gross).toBe(TOTAL)
    })

    it("refuses a role that may not see money (rule #66)", async () => {
      const g = await guest("desk@aurora.test")
      await db.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, g.id))
      await db
        .insert(partnerMembers)
        .values({ orgId: fx.org.id, userId: g.id, role: "staff", status: "active" })

      // Front-desk staff belong on the extranet - just not on this screen.
      await partnerGet("overview", g.cookie).expect(403)
      await partnerGet("revenue", g.cookie).expect(403)
    })

    it("breaks revenue down by period and by property", async () => {
      await stay()
      await stay({ total: 100_000, commissionAmount: 15_000 })
      const cookie = await partner("fin5@aurora.test")

      const res = await partnerGet("revenue", cookie, { granularity: "month" }).expect(200)

      expect(res.body.totals.gross).toBe(TOTAL + 100_000)
      expect(res.body.points.length).toBeGreaterThan(0)
      // Every bucket carries the same three words as the totals do.
      for (const point of res.body.points) {
        expect(point.gross - point.commission).toBe(point.net)
      }
      expect(res.body.byProperty).toHaveLength(1)
      expect(res.body.byProperty[0]).toMatchObject({
        propertyId: fx.aurora.property.id,
        gross: TOTAL + 100_000,
      })
    })

    it("reports the commission rate actually achieved, not the one on file today", async () => {
      // Two bookings at 15%, then the org's rate changes. The report must
      // still describe the month that happened.
      await stay()
      await stay()
      await db
        .update(partnerOrgs)
        .set({ commissionRateBps: 900 })
        .where(eq(partnerOrgs.id, fx.org.id))
      const cookie = await partner("fin6@aurora.test")

      const rows = (await partnerGet("commissions", cookie).expect(200)).body
      expect(rows.length).toBeGreaterThan(0)
      expect(rows[0].rateBps).toBe(1500)
      expect(rows[0].propertyId).toBe(fx.aurora.property.id)
    })

    it("lists transactions newest first, paged by keyset", async () => {
      await stay()
      await stay()
      await stay()
      const cookie = await partner("fin7@aurora.test")

      const page = await partnerGet("transactions", cookie, { limit: 2 }).expect(200)
      expect(page.body.items).toHaveLength(2)
      expect(page.body.nextCursor).toBeTruthy()

      const next = await partnerGet("transactions", cookie, {
        limit: 2,
        before: page.body.nextCursor,
      }).expect(200)
      expect(next.body.items).toHaveLength(1)
      expect(next.body.nextCursor).toBeNull()

      for (const row of [...page.body.items, ...next.body.items]) {
        expect(row.gross - row.commission).toBe(row.net)
      }
    })

    it("shows a voided commission as zero on the ledger line itself", async () => {
      await stay({ commissionStatus: "void" })
      const cookie = await partner("fin8@aurora.test")

      const res = await partnerGet("transactions", cookie).expect(200)
      // Not the original amount with a flag beside it: the partner does not
      // owe it, and a line still showing the charge is one they will query.
      expect(res.body.items[0]).toMatchObject({ commission: 0, net: TOTAL })
    })

    it("gives the platform the same report with the scope taken off (rule #84)", async () => {
      await stay()
      await stay({ orgProperty: fx.other })
      const root = await admin("finroot@stayora.test")

      const all = await adminGet("overview", root).expect(200)
      expect(all.body.bookings).toBe(2)

      // Narrowed to one client, it must agree with that client's own screen.
      const oneOrg = await adminGet("overview", root, { orgId: fx.org.id }).expect(200)
      const cookie = await partner("fin9@aurora.test")
      const theirs = await partnerGet("overview", cookie).expect(200)

      expect(oneOrg.body.gross).toBe(theirs.body.gross)
      expect(oneOrg.body.commission).toBe(theirs.body.commission)
      // A marketplace-wide screen cannot claim one collection mode.
      expect(all.body.settlementMode).toBeUndefined()
    })

    it("is closed to partners and to guests", async () => {
      const cookie = await partner("fin10@aurora.test")
      await adminGet("overview", cookie).expect(403)

      const g = await guest("plain@example.com")
      await partnerGet("overview", g.cookie).expect(403)
      await request(server()).get("/api/v1/partner/finance/overview").expect(401)
    })

    it("refuses a window longer than the cap, and one that runs backwards", async () => {
      const cookie = await partner("fin11@aurora.test")
      await partnerGet("overview", cookie, { from: "2020-01-01", to: "2026-01-01" }).expect(400)
      await partnerGet("overview", cookie, { from: iso(0), to: iso(-10) }).expect(400)
    })
  })
})
