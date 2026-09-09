import { Inject, Injectable } from "@nestjs/common"
import { REALISED_STATUSES } from "@stayora/shared"
import { sql, type SQL } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"

/**
 * The money screens (extranet `finance/*`, admin `finance/*`).
 *
 * Separate from `FinanceRepository`, which MOVES money — this one only reads
 * what moved. Keeping them apart means a reporting query can never be the
 * thing that writes a payout row by accident.
 *
 * Everything here counts on the BOOKING date, not the stay date (rule #97).
 * Analytics does the opposite for ADR and occupancy, and deliberately: those
 * ask "how did the hotel trade", these ask "what is owed and to whom", and a
 * commission belongs to the booking that a payout line and an invoice line
 * will both name.
 */
@Injectable()
export class FinanceReportsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ---------------------------------------------------------------- totals */

  async totals(scope: Scope & Window) {
    const where = scopeWhere(scope)
    if (!where) return EMPTY_TOTALS

    const result = await this.db.execute<TotalsRow>(sql`
      SELECT
        COUNT(*) FILTER (WHERE b.status IN (${REALISED}))::int AS bookings,
        COALESCE(SUM(b.total) FILTER (WHERE b.status IN (${REALISED})), 0)::bigint AS gross,
        COALESCE(SUM(b.commission_amount) FILTER (
          -- Commission the platform gave up on a goodwill refund is not owed
          -- any more (rule #76). Counting it bills the partner for a gesture.
          WHERE b.status IN (${REALISED}) AND b.commission_status <> 'void'
        ), 0)::bigint AS commission,
        COUNT(*) FILTER (WHERE b.status IN ('cancelled', 'no_show'))::int AS cancelled,
        COALESCE(SUM(b.refund_amount), 0)::bigint AS refunded
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE ${where}
        AND ${bookedBetween(scope)}
    `)

    return readTotals(result.rows[0])
  }

  /* ------------------------------------------------------------ the trend */

  /**
   * Gross, commission and net over time.
   *
   * `date_trunc` takes its unit as text and cannot be parameterised, so the
   * unit is concatenated — through a closed lookup, which is what keeps that
   * from being an injection point even after the zod enum has passed it.
   */
  async byPeriod(scope: Scope & Window & { granularity: Granularity }) {
    const where = scopeWhere(scope)
    if (!where) return []

    const unit = TRUNC[scope.granularity]
    const result = await this.db.execute<TotalsRow & { period: string }>(sql`
      SELECT
        to_char(
          date_trunc('${sql.raw(unit)}', (b.created_at AT TIME ZONE p.timezone)),
          'YYYY-MM-DD'
        ) AS period,
        COUNT(*) FILTER (WHERE b.status IN (${REALISED}))::int AS bookings,
        COALESCE(SUM(b.total) FILTER (WHERE b.status IN (${REALISED})), 0)::bigint AS gross,
        COALESCE(SUM(b.commission_amount) FILTER (
          WHERE b.status IN (${REALISED}) AND b.commission_status <> 'void'
        ), 0)::bigint AS commission,
        COUNT(*) FILTER (WHERE b.status IN ('cancelled', 'no_show'))::int AS cancelled,
        COALESCE(SUM(b.refund_amount), 0)::bigint AS refunded
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE ${where}
        AND ${bookedBetween(scope)}
      GROUP BY 1
      ORDER BY 1
    `)

    return result.rows.map((row) => ({ period: row.period, ...readTotals(row) }))
  }

  /* ------------------------------------------------------- by property -- */

  async byProperty(scope: Scope & Window) {
    const where = scopeWhere(scope)
    if (!where) return []

    const result = await this.db.execute<
      TotalsRow & { property_id: string; property_name: string; city: string }
    >(sql`
      SELECT
        p.id   AS property_id,
        p.name AS property_name,
        p.city AS city,
        COUNT(*) FILTER (WHERE b.status IN (${REALISED}))::int AS bookings,
        COALESCE(SUM(b.total) FILTER (WHERE b.status IN (${REALISED})), 0)::bigint AS gross,
        COALESCE(SUM(b.commission_amount) FILTER (
          WHERE b.status IN (${REALISED}) AND b.commission_status <> 'void'
        ), 0)::bigint AS commission,
        COUNT(*) FILTER (WHERE b.status IN ('cancelled', 'no_show'))::int AS cancelled,
        COALESCE(SUM(b.refund_amount), 0)::bigint AS refunded
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE ${where}
        AND ${bookedBetween(scope)}
      GROUP BY p.id, p.name, p.city
      ORDER BY gross DESC
    `)

    return result.rows.map((row) => ({
      propertyId: row.property_id,
      propertyName: row.property_name,
      city: row.city,
      ...readTotals(row),
    }))
  }

  /* ------------------------------------------------- month by property -- */

  /**
   * The commission report: one row per property per month.
   *
   * The rate is carried per booking (`commission_rate_bps`), so it is averaged
   * across the month rather than read off the organisation. An org whose rate
   * was renegotiated mid-month really did earn at two rates, and showing
   * today's rate against last month's money is a report that will not add up.
   */
  async commissionsByMonth(scope: Scope & Window) {
    const where = scopeWhere(scope)
    if (!where) return []

    const result = await this.db.execute<
      TotalsRow & {
        month: string
        property_id: string
        property_name: string
        org_id: string
        org_name: string
        rate_bps: string
      }
    >(sql`
      SELECT
        to_char(date_trunc('month', (b.created_at AT TIME ZONE p.timezone)), 'YYYY-MM') AS month,
        p.id   AS property_id,
        p.name AS property_name,
        o.id   AS org_id,
        o.name AS org_name,
        COALESCE(
          ROUND(
            SUM(b.commission_rate_bps * b.total) FILTER (WHERE b.status IN (${REALISED}))::numeric
            / NULLIF(SUM(b.total) FILTER (WHERE b.status IN (${REALISED})), 0)
          ),
          0
        )::bigint AS rate_bps,
        COUNT(*) FILTER (WHERE b.status IN (${REALISED}))::int AS bookings,
        COALESCE(SUM(b.total) FILTER (WHERE b.status IN (${REALISED})), 0)::bigint AS gross,
        COALESCE(SUM(b.commission_amount) FILTER (
          WHERE b.status IN (${REALISED}) AND b.commission_status <> 'void'
        ), 0)::bigint AS commission,
        COUNT(*) FILTER (WHERE b.status IN ('cancelled', 'no_show'))::int AS cancelled,
        COALESCE(SUM(b.refund_amount), 0)::bigint AS refunded
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      JOIN partner_orgs o ON o.id = p.partner_org_id
      WHERE ${where}
        AND ${bookedBetween(scope)}
      GROUP BY 1, p.id, p.name, o.id, o.name
      ORDER BY 1 DESC, gross DESC
    `)

    return result.rows.map((row) => ({
      month: row.month,
      propertyId: row.property_id,
      propertyName: row.property_name,
      orgId: row.org_id,
      orgName: row.org_name,
      rateBps: Number(row.rate_bps),
      ...readTotals(row),
    }))
  }

  /* ------------------------------------------------------- transactions -- */

  /**
   * The ledger, one booking per row.
   *
   * Keyset on `created_at`, never OFFSET: this is the most append-heavy table
   * in the system, and paging by offset re-reads everything already scrolled
   * past — and shifts under the reader as new bookings arrive.
   */
  async transactions(scope: Scope & Window & { limit: number; before?: string }) {
    const where = scopeWhere(scope)
    if (!where) return { rows: [], nextCursor: null }

    const before = scope.before ?? null
    const result = await this.db.execute<TransactionRow>(sql`
      SELECT
        b.id                AS booking_id,
        b.ref               AS ref,
        b.created_at        AS booked_at,
        b.check_in          AS check_in,
        b.check_out         AS check_out,
        trim(b.guest_first_name || ' ' || b.guest_last_name) AS guest_name,
        b.property_id       AS property_id,
        b.property_name     AS property_name,
        b.room_name         AS room_name,
        b.total             AS gross,
        b.commission_amount AS commission_raw,
        b.commission_status AS commission_status,
        COALESCE(b.refund_amount, 0) AS refunded,
        b.payment_mode      AS payment_mode,
        b.source            AS source,
        b.status            AS status
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE ${where}
        AND ${bookedBetween(scope)}
        AND (${before}::timestamptz IS NULL OR b.created_at < ${before}::timestamptz)
      ORDER BY b.created_at DESC
      LIMIT ${scope.limit + 1}
    `)

    const rows = result.rows
    const hasMore = rows.length > scope.limit
    const page = hasMore ? rows.slice(0, scope.limit) : rows
    return { rows: page, nextCursor: hasMore ? page[page.length - 1]!.booked_at : null }
  }

  /* ------------------------------------------------------- open balances -- */

  /**
   * Money that has been counted but not yet moved.
   *
   * Two different things, deliberately not summed: a pending payout is what
   * the platform owes the partner, an unpaid invoice is what the partner owes
   * the platform. Netting them into one figure hides which way it is going.
   */
  async openBalances(orgId?: string) {
    const orgFilter = orgId ? sql`AND partner_org_id = ${orgId}::uuid` : sql``

    const [payouts, invoices] = await Promise.all([
      this.db.execute<{ amount: string; count: number }>(sql`
        SELECT COALESCE(SUM(net_amount), 0)::bigint AS amount, COUNT(*)::int AS count
        FROM payouts
        WHERE status IN ('pending', 'processing') ${orgFilter}
      `),
      this.db.execute<{ amount: string; count: number }>(sql`
        SELECT COALESCE(SUM(amount), 0)::bigint AS amount, COUNT(*)::int AS count
        FROM commission_invoices
        WHERE status IN ('issued', 'overdue') ${orgFilter}
      `),
    ])

    return {
      pendingPayouts: {
        amount: Number(payouts.rows[0]?.amount ?? 0),
        count: payouts.rows[0]?.count ?? 0,
      },
      outstandingInvoices: {
        amount: Number(invoices.rows[0]?.amount ?? 0),
        count: invoices.rows[0]?.count ?? 0,
      },
    }
  }
}

/* ============================================================== internals == */

export type Granularity = "day" | "week" | "month"

/**
 * Which rows this caller may see.
 *
 * `propertyIds` for a partner (already intersected with what the session
 * allows), `all` for the platform with an optional org filter. Two shapes
 * rather than an optional array, so "no scope at all" cannot be expressed by
 * forgetting a field.
 */
export type Scope =
  | { kind: "properties"; propertyIds: readonly string[] }
  | { kind: "platform"; orgId?: string }

export type Window = { from: string; to: string }

export type TransactionRow = {
  booking_id: string
  ref: string
  booked_at: string
  check_in: string
  check_out: string
  guest_name: string
  property_id: string
  property_name: string
  room_name: string
  gross: number
  commission_raw: number
  commission_status: string
  refunded: number
  payment_mode: string
  source: string
  status: string
}

type TotalsRow = {
  bookings: number
  gross: string
  commission: string
  cancelled: number
  refunded: string
}

const EMPTY_TOTALS = { bookings: 0, gross: 0, commission: 0, net: 0, cancelled: 0, refunded: 0 }

/** The statuses that count as money earned (rule #63). */
const REALISED = sql.join(
  REALISED_STATUSES.map((s) => sql`${s}`),
  sql`, `
)

const TRUNC: Record<Granularity, string> = {
  day: "day",
  week: "week",
  month: "month",
}

/**
 * `null` when the scope selects nothing.
 *
 * A partner with no properties must produce an empty report, never an
 * unfiltered one — and `IN ()` is a syntax error, so the caller checks for
 * `null` and returns zeroes rather than building a query at all.
 */
function scopeWhere(scope: Scope): SQL | null {
  if (scope.kind === "properties") {
    if (scope.propertyIds.length === 0) return null
    return sql`b.property_id IN (${sql.join(
      scope.propertyIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )})`
  }
  return scope.orgId ? sql`p.partner_org_id = ${scope.orgId}::uuid` : sql`TRUE`
}

/**
 * The booking date, in the PROPERTY's timezone.
 *
 * A stay sold at 11pm in Tokyo belongs to that day's takings in Tokyo, not to
 * whatever date it was in UTC. Every other date-bucketed query in the codebase
 * does the same, and a report that disagreed would put a booking in a
 * different month from the invoice that bills it.
 */
function bookedBetween(window: Window): SQL {
  return sql`(b.created_at AT TIME ZONE p.timezone)::date >= ${window.from}::date
             AND (b.created_at AT TIME ZONE p.timezone)::date <= ${window.to}::date`
}

/** Aggregates come back as strings from node-postgres. Cast at the boundary. */
function readTotals(row?: TotalsRow) {
  const gross = Number(row?.gross ?? 0)
  const commission = Number(row?.commission ?? 0)
  return {
    bookings: row?.bookings ?? 0,
    gross,
    commission,
    // The partner's side of the same money. Named, so nothing has to remember
    // which "revenue" a column meant (rule #82).
    net: gross - commission,
    cancelled: row?.cancelled ?? 0,
    refunded: Number(row?.refunded ?? 0),
  }
}
