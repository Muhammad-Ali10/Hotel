import { Inject, Injectable, Logger } from "@nestjs/common"
import { and, asc, desc, eq, gt, inArray, isNull, lt, lte, ne, or, sql, type SQL } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  bookings,
  commissionInvoiceLines,
  commissionInvoices,
  partnerOrgs,
  partnerPayoutAccounts,
  payoutItems,
  payouts,
  payments,
  properties,
} from "../../db/schema"

export type PayoutRow = typeof payouts.$inferSelect

/** A booking waiting to be settled, with what the ledger says about it. */
export type ReleasableBooking = {
  bookingId: string
  checkOut: string
  commissionAmount: number
  commissionStatus: string
  captured: number
  refunded: number
  /** From the rate plan — who received the guest's money (rules #42, #93). */
  paymentMode: "prepay" | "guarantee"
}

/**
 * How many rows one round-trip carries — a page size, not a ceiling.
 *
 * Both of the queries below used this as a hard `LIMIT` with no cursor, which
 * is the same mistake in two places: an organisation with more outstanding
 * bookings than this had the remainder silently left out of its payout, with
 * nothing in the result to say so. It was not lost — both runs are idempotent
 * and the next cycle collected it — but "paid a fortnight late for reasons
 * nobody can see" is not a thing a finance report should be able to do.
 */
const PAGE = 5_000

/**
 * A stop, so a bug cannot turn a payout run into an infinite loop.
 *
 * Two hundred thousand bookings in one organisation's outstanding balance is
 * not a real number; reaching it means the cursor is not advancing. It is
 * logged at `error` rather than swallowed, because the difference between
 * "this org has no more" and "this loop gave up" is the whole point.
 */
const MAX_PAGES = 40

@Injectable()
export class FinanceRepository {
  private readonly logger = new Logger(FinanceRepository.name)

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ------------------------------------------------------------------ read */

  /** Every org that could have money moving. */
  async activeOrgIds(): Promise<string[]> {
    const rows = await this.db
      .select({ id: partnerOrgs.id })
      .from(partnerOrgs)
      .where(ne(partnerOrgs.status, "suspended"))
    return rows.map((r) => r.id)
  }

  /**
   * Bookings whose money may now move, and which nothing has paid out yet.
   *
   * Deliberately NOT filtered by the period's dates.
   *
   * A run picks up everything outstanding, whenever it became releasable. A
   * booking missed by an earlier run — the org had no verified account, the job
   * died halfway, a period boundary was computed wrong — is collected by the
   * next one instead of falling into a gap nobody ever looks in again. The
   * period is a label on the run, not a filter on the money.
   *
   * The LEFT JOIN against `payout_items` is what makes that safe to repeat:
   * anything already settled simply is not here.
   */
  async releasableFor(input: { orgId: string; onOrBefore: string }): Promise<ReleasableBooking[]> {
    const all: ReleasableBooking[] = []
    let after: { checkOut: string; id: string } | null = null

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const rows = await this.releasablePage({ ...input, after })
      all.push(...rows)
      if (rows.length < PAGE) return all

      const last = rows[rows.length - 1]!
      after = { checkOut: last.checkOut, id: last.bookingId }
    }

    this.logger.error(
      `releasableFor stopped at ${MAX_PAGES} pages for org ${input.orgId} — the cursor is not advancing`
    )
    return all
  }

  /** One page, ordered so the next page can start exactly where this ended. */
  private async releasablePage(input: {
    orgId: string
    onOrBefore: string
    after: { checkOut: string; id: string } | null
  }): Promise<ReleasableBooking[]> {
    const rows = await this.db
      .select({
        bookingId: bookings.id,
        checkOut: bookings.checkOut,
        commissionAmount: bookings.commissionAmount,
        commissionStatus: bookings.commissionStatus,
        // Decides whether the commission can be held back at all: on a
        // guarantee the platform received nothing to hold back (rule #93).
        paymentMode: bookings.paymentMode,
        /*
         * Summed in SQL, per booking.
         *
         * `captured` counts money that actually arrived — a payment sitting in
         * `authorized` is a promise, and paying a property against a promise
         * is how a platform funds a stay out of its own pocket.
         */
        captured: sql<number>`COALESCE(SUM(
          CASE WHEN ${payments.status} IN ('captured', 'refunded', 'partially_refunded')
               THEN ${payments.amount} ELSE 0 END
        ), 0)::int`,
        refunded: sql<number>`COALESCE(SUM(${payments.amountRefunded}), 0)::int`,
      })
      .from(bookings)
      .innerJoin(properties, eq(properties.id, bookings.propertyId))
      .leftJoin(payments, eq(payments.bookingId, bookings.id))
      .leftJoin(payoutItems, eq(payoutItems.bookingId, bookings.id))
      .where(
        and(
          eq(properties.partnerOrgId, input.orgId),
          // The stay's outcome is known: `earned` or `void`, never `pending`.
          ne(bookings.commissionStatus, "pending"),
          // The hold has elapsed (rule #49).
          lte(bookings.checkOut, input.onOrBefore),
          // Nothing has settled it yet.
          isNull(payoutItems.id),
          /*
           * The keyset. `check_out` is a DATE, so a great many bookings share
           * one — the id is what stops a page boundary skipping the rest of
           * a busy day (see `common/pagination/keyset.ts`).
           */
          ...(input.after
            ? [
                or(
                  gt(bookings.checkOut, input.after.checkOut),
                  and(
                    eq(bookings.checkOut, input.after.checkOut),
                    gt(bookings.id, input.after.id)
                  )
                )!,
              ]
            : [])
        )
      )
      .groupBy(bookings.id)
      .orderBy(asc(bookings.checkOut), asc(bookings.id))
      .limit(PAGE)

    return rows.map((row) => ({
      ...row,
      captured: Number(row.captured),
      refunded: Number(row.refunded),
      paymentMode: row.paymentMode as "prepay" | "guarantee",
    }))
  }

  /**
   * The balance brought forward (rules #50, #52).
   *
   * The org's most recent settlement, if it did not actually move money: a
   * `carry` too small to be worth a transfer, or an `invoice` they have not
   * paid. Both roll into the next cycle — otherwise a property owed $60 a
   * fortnight is never paid at all, and a property that owes US can wipe the
   * debt by having one good period.
   */
  async carryInFor(orgId: string): Promise<number> {
    const [row] = await this.db
      .select({ netAmount: payouts.netAmount, direction: payouts.direction, status: payouts.status })
      .from(payouts)
      .where(eq(payouts.partnerOrgId, orgId))
      .orderBy(desc(payouts.periodStart))
      .limit(1)

    if (!row) return 0
    if (row.status === "paid") return 0
    return row.direction === "carry" || row.direction === "invoice" ? row.netAmount : 0
  }

  async payoutAccountFor(orgId: string) {
    const [row] = await this.db
      .select()
      .from(partnerPayoutAccounts)
      .where(eq(partnerPayoutAccounts.partnerOrgId, orgId))
      .limit(1)
    return row ?? null
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(payouts).where(eq(payouts.id, id)).limit(1)
    return row ?? null
  }

  async itemsFor(payoutId: string) {
    return this.db.select().from(payoutItems).where(eq(payoutItems.payoutId, payoutId))
  }

  async listForOrg(orgId: string, limit: number) {
    return this.db
      .select()
      .from(payouts)
      .where(eq(payouts.partnerOrgId, orgId))
      .orderBy(desc(payouts.periodStart))
      .limit(limit)
  }

  /**
   * Every org's payouts, with the org named.
   *
   * The partner's own list does not need this — they can only see their own.
   * The platform's does: a settlement row that does not say whose money it is
   * cannot be acted on, and "retry this failed payout" is a question about a
   * specific business.
   */
  async listAll(input: { status?: string; orgId?: string; limit: number }) {
    const where = [
      ...(input.status ? [eq(payouts.status, input.status)] : []),
      ...(input.orgId ? [eq(payouts.partnerOrgId, input.orgId)] : []),
    ]

    return this.db
      .select({ payout: payouts, orgName: partnerOrgs.name })
      .from(payouts)
      .innerJoin(partnerOrgs, eq(partnerOrgs.id, payouts.partnerOrgId))
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(payouts.periodStart))
      .limit(input.limit)
  }

  /* ----------------------------------------------------------------- write */

  /**
   * Registers or replaces where an org's money is sent.
   *
   * Always lands `unverified`, whoever calls it. Re-pointing a payout account
   * is the single highest-value action anyone can take in this system — it is
   * how a compromised partner login turns into a bank transfer — so a change
   * always costs the org its verified status and has to be re-approved.
   */
  async upsertPayoutAccount(input: {
    orgId: string
    provider: string
    providerAccountRef: string
    holderName: string
    last4: string
    bankName: string
    currency: string
  }) {
    const [row] = await this.db
      .insert(partnerPayoutAccounts)
      .values({
        partnerOrgId: input.orgId,
        provider: input.provider,
        providerAccountRef: input.providerAccountRef,
        holderName: input.holderName,
        last4: input.last4,
        bankName: input.bankName,
        currency: input.currency,
        status: "unverified",
      })
      .onConflictDoUpdate({
        target: partnerPayoutAccounts.partnerOrgId,
        set: {
          provider: input.provider,
          providerAccountRef: input.providerAccountRef,
          holderName: input.holderName,
          last4: input.last4,
          bankName: input.bankName,
          currency: input.currency,
          status: "unverified",
          updatedAt: new Date().toISOString(),
        },
      })
      .returning()
    return row!
  }

  /** Admin approval. The only way an account becomes payable. */
  async setPayoutAccountStatus(orgId: string, status: string) {
    const [row] = await this.db
      .update(partnerPayoutAccounts)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(partnerPayoutAccounts.partnerOrgId, orgId))
      .returning()
    return row ?? null
  }

  /**
   * Writes a settlement and its lines in ONE transaction.
   *
   * The two have to land together or not at all. A payout row with no items is
   * a figure nobody can explain; items with no payout are stays marked settled
   * against a settlement that does not exist — and because the items carry the
   * unique key, those bookings would never be paid at all.
   */
  async createSettlement(input: {
    orgId: string
    periodStart: string
    periodEnd: string
    grossAmount: number
    commissionAmount: number
    carryIn: number
    netAmount: number
    direction: string
    items: { bookingId: string; grossAmount: number; commissionAmount: number; netAmount: number }[]
  }): Promise<PayoutRow | null> {
    return this.db.transaction(async (tx) => {
      const [payout] = await tx
        .insert(payouts)
        .values({
          partnerOrgId: input.orgId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          grossAmount: input.grossAmount,
          commissionAmount: input.commissionAmount,
          carryIn: input.carryIn,
          netAmount: input.netAmount,
          direction: input.direction,
        })
        // A run that fires twice — a retry, two instances, a manual re-run —
        // produces one row. The unique key decides, not a prior read.
        .onConflictDoNothing({ target: [payouts.partnerOrgId, payouts.periodStart] })
        .returning()

      if (!payout) return null

      if (input.items.length > 0) {
        await tx.insert(payoutItems).values(
          input.items.map((item) => ({ ...item, payoutId: payout.id }))
        )
      }

      return payout
    })
  }

  /** Moves a settlement forward, guarded on the status it is moving from. */
  async advance(input: {
    payoutId: string
    fromStatus: string
    toStatus: string
    provider?: string
    providerRef?: string
    paidAt?: string | null
    failureReason?: string | null
  }) {
    const [row] = await this.db
      .update(payouts)
      .set({
        status: input.toStatus,
        ...(input.provider ? { provider: input.provider } : {}),
        ...(input.providerRef ? { providerRef: input.providerRef } : {}),
        ...(input.paidAt !== undefined ? { paidAt: input.paidAt } : {}),
        ...(input.failureReason !== undefined ? { failureReason: input.failureReason } : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(payouts.id, input.payoutId), eq(payouts.status, input.fromStatus)))
      .returning()
    return row ?? null
  }

  /** The properties an org owns — for scoping a partner's own view. */
  async orgOwns(orgId: string, payoutId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: payouts.id })
      .from(payouts)
      .where(and(eq(payouts.id, payoutId), eq(payouts.partnerOrgId, orgId)))
      .limit(1)
    return row !== undefined
  }

  /** Booking references for a settlement's lines, so a statement reads. */
  async bookingRefsFor(bookingIds: string[]) {
    if (bookingIds.length === 0) return new Map<string, { ref: string; checkOut: string }>()
    const rows = await this.db
      .select({ id: bookings.id, ref: bookings.ref, checkOut: bookings.checkOut })
      .from(bookings)
      .where(inArray(bookings.id, bookingIds))
    return new Map(rows.map((r) => [r.id, { ref: r.ref, checkOut: r.checkOut }]))
  }
  /**
   * How this org's commission is collected, and whether its money is held.
   *
   * Read at payout time rather than snapshotted onto the booking: the mode is
   * a standing arrangement with the partner, not a term of any one stay, and a
   * partner moved to `deduct` for an unpaid invoice (rule #95) must have that
   * apply to the very next run.
   */
  async orgSettlement(orgId: string) {
    const [row] = await this.db
      .select({
        settlementMode: partnerOrgs.settlementMode,
        payoutsHeld: partnerOrgs.payoutsHeld,
        commissionRateBps: partnerOrgs.commissionRateBps,
      })
      .from(partnerOrgs)
      .where(eq(partnerOrgs.id, orgId))
      .limit(1)

    return {
      settlementMode: (row?.settlementMode ?? "deduct") as "deduct" | "invoice",
      payoutsHeld: row?.payoutsHeld ?? false,
      commissionRateBps: row?.commissionRateBps ?? 0,
    }
  }
  /* ------------------------------------------------------------ invoices -- */

  /**
   * Commission owed for a month that no invoice has claimed yet (rule #91).
   *
   * The LEFT JOIN against `commission_invoice_lines` is what makes the run
   * safe to repeat — a booking already billed simply is not here. The unique
   * index on `booking_id` is the guard; this is the query that stops it ever
   * being reached.
   *
   * Only bookings whose commission is `earned`: a stay still in its hold, or
   * one whose commission was voided on a goodwill refund (rule #76), is not
   * money anybody owes.
   */
  async billableFor(input: { orgId: string; from: string; to: string }) {
    const all: { bookingId: string; ref: string; total: number; commission: number }[] = []
    let after: { checkOut: string; id: string } | null = null

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const rows = await this.billablePage({ ...input, after })
      all.push(...rows.items)
      if (rows.items.length < PAGE) return all
      after = rows.last
    }

    this.logger.error(
      `billableFor stopped at ${MAX_PAGES} pages for org ${input.orgId} — the cursor is not advancing`
    )
    return all
  }

  private async billablePage(input: {
    orgId: string
    from: string
    to: string
    after: { checkOut: string; id: string } | null
  }) {
    const result = await this.db.execute<{
      booking_id: string
      ref: string
      total: number
      commission: number
      check_out: string
    }>(sql`
      SELECT b.id AS booking_id, b.ref, b.total, b.commission_amount AS commission, b.check_out
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      LEFT JOIN commission_invoice_lines cil ON cil.booking_id = b.id
      WHERE p.partner_org_id = ${input.orgId}::uuid
        AND b.commission_status = 'earned'
        AND b.check_out >= ${input.from}::date
        AND b.check_out <= ${input.to}::date
        AND cil.booking_id IS NULL
        AND (
          ${input.after === null}
          OR (b.check_out, b.id) > (${input.after?.checkOut ?? null}::date, ${input.after?.id ?? null}::uuid)
        )
      ORDER BY b.check_out ASC, b.id ASC
      LIMIT ${PAGE}
    `)

    const items = result.rows.map((row) => ({
      bookingId: row.booking_id,
      ref: row.ref,
      total: Number(row.total),
      commission: Number(row.commission),
    }))
    const tail = result.rows[result.rows.length - 1]

    return {
      items,
      last: tail
        ? { checkOut: String(tail.check_out).slice(0, 10), id: tail.booking_id }
        : null,
    }
  }

  /**
   * Writes an invoice and its lines together.
   *
   * One transaction: an invoice with no lines is a bill a partner cannot
   * check, and lines with no invoice are rows nothing will ever read.
   */
  async createInvoice(input: {
    invoice: typeof commissionInvoices.$inferInsert
    lines: Omit<typeof commissionInvoiceLines.$inferInsert, "invoiceId">[]
  }) {
    return this.db.transaction(async (tx) => {
      const [invoice] = await tx.insert(commissionInvoices).values(input.invoice).returning()
      if (input.lines.length > 0) {
        await tx
          .insert(commissionInvoiceLines)
          .values(input.lines.map((line) => ({ ...line, invoiceId: invoice!.id })))
      }
      return invoice!
    })
  }

  async findInvoice(invoiceId: string) {
    const [row] = await this.db
      .select()
      .from(commissionInvoices)
      .where(eq(commissionInvoices.id, invoiceId))
      .limit(1)
    return row ?? null
  }

  async invoiceLines(invoiceId: string) {
    return this.db
      .select()
      .from(commissionInvoiceLines)
      .where(eq(commissionInvoiceLines.invoiceId, invoiceId))
      .orderBy(asc(commissionInvoiceLines.createdAt))
  }

  async listInvoices(input: { orgId?: string; status?: string; limit: number }) {
    const where: SQL[] = []
    if (input.orgId) where.push(eq(commissionInvoices.partnerOrgId, input.orgId))
    if (input.status) where.push(eq(commissionInvoices.status, input.status))

    return this.db
      .select()
      .from(commissionInvoices)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(commissionInvoices.periodStart))
      .limit(input.limit)
  }

  /**
   * The same list, with the client named.
   *
   * A separate method rather than an optional join on `listInvoices`: the
   * partner's own list is already scoped to one organisation and naming it on
   * every row would be noise, while the platform's is unusable without it.
   * Two methods, two meanings — an optional flag would make one function
   * answer two different questions depending on who called it.
   */
  async listInvoicesWithOrg(input: {
    orgId?: string
    status?: string
    limit: number
  }) {
    const where: SQL[] = []
    if (input.orgId) where.push(eq(commissionInvoices.partnerOrgId, input.orgId))
    if (input.status) where.push(eq(commissionInvoices.status, input.status))

    return this.db
      .select({ invoice: commissionInvoices, orgName: partnerOrgs.name })
      .from(commissionInvoices)
      .innerJoin(partnerOrgs, eq(partnerOrgs.id, commissionInvoices.partnerOrgId))
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(commissionInvoices.periodStart))
      .limit(input.limit)
  }

  async updateInvoice(invoiceId: string, patch: Partial<typeof commissionInvoices.$inferInsert>) {
    const [row] = await this.db
      .update(commissionInvoices)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(commissionInvoices.id, invoiceId))
      .returning()
    return row ?? null
  }

  /** Invoices that have run out of time — what rule #95 acts on. */
  async overdueInvoices(today: string) {
    return this.db
      .select()
      .from(commissionInvoices)
      .where(
        and(eq(commissionInvoices.status, "issued"), lt(commissionInvoices.dueDate, today))
      )
      .limit(500)
  }

  /** Whether this org still owes anything — decides when payouts resume. */
  async hasUnpaidInvoices(orgId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(commissionInvoices)
      .where(
        and(
          eq(commissionInvoices.partnerOrgId, orgId),
          inArray(commissionInvoices.status, ["issued", "overdue"])
        )
      )
    return Number(row?.count ?? 0) > 0
  }

  async setOrgSettlement(
    orgId: string,
    patch: { settlementMode?: string; payoutsHeld?: boolean }
  ) {
    const [row] = await this.db
      .update(partnerOrgs)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(partnerOrgs.id, orgId))
      .returning({
        id: partnerOrgs.id,
        name: partnerOrgs.name,
        settlementMode: partnerOrgs.settlementMode,
        payoutsHeld: partnerOrgs.payoutsHeld,
      })
    return row ?? null
  }

  /**
   * The next number for a reference (rule #8).
   *
   * The same sequence tickets use. Sharing it costs nothing and buys one
   * property worth having: neither an invoice nor a ticket reference lets
   * anybody guess the next one, or count how many exist.
   */
  async nextSequence(): Promise<number> {
    const result = await this.db.execute<{ n: string }>(
      sql`SELECT nextval('support_ticket_seq') AS n`
    )
    return Number(result.rows[0]?.n ?? 1)
  }

  /** Every org on `invoice`, plus any with billable guarantee commission. */
  async orgsToBill() {
    const result = await this.db.execute<{ id: string; name: string }>(sql`
      SELECT id, name FROM partner_orgs
      WHERE status <> 'suspended'
      ORDER BY name ASC
    `)
    return result.rows
  }
}
