import { Inject, Injectable } from "@nestjs/common"
import type { AnalyticsGranularity } from "@stayora/shared"
import { REALISED_STATUSES } from "@stayora/shared"
import { sql, type SQL } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"

/* ============================================================================
 * The analytics queries (rules #62–#66).
 *
 * Three facts about this stack drive how everything below is written, each one
 * proved against the database rather than assumed:
 *
 *  1. `db.execute` returns rows keyed in **snake_case**, whatever the TypeScript
 *     says. Typing a row as camelCase compiles and yields `undefined` for every
 *     field — that exact mistake once left the notification worker silently
 *     sending nothing. Row types here are snake_case and mapped by hand.
 *
 *  2. `SUM()` and `AVG()` come back as **strings** — Postgres `bigint` and
 *     `numeric` have no lossless JS number, so the driver refuses to guess.
 *     Every aggregate is `Number()`-ed at the boundary. Miss one and the
 *     arithmetic silently becomes string concatenation.
 *
 *  3. `id = ANY(${array})` does **not** work: Drizzle expands a JS array into
 *     `($1, $2)`, a row constructor, and Postgres rejects the cast. Scoping
 *     goes through `idList()` below, which builds a parameterised `IN` list.
 * ========================================================================== */

/**
 * A parameterised `IN (…)` list of property ids.
 *
 * Every id is its own bind parameter, so nothing here is string interpolation
 * however the ids arrived. Callers must handle the empty case before calling —
 * `IN ()` is a syntax error, and a query that silently matched everything would
 * be the worst possible failure mode for a scoping helper (API1).
 */
function idList(ids: readonly string[]): SQL {
  return sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `
  )
}

/** The statuses that sold a room-night, as a SQL list (rule #63). */
const REALISED = sql.join(
  REALISED_STATUSES.map((s) => sql`${s}`),
  sql`, `
)

/**
 * `date_trunc` unit for a granularity.
 *
 * A lookup rather than the string itself: `date_trunc` takes its unit as text
 * and cannot be parameterised, so the value is concatenated into SQL. Mapping
 * through a closed object is what keeps that from being an injection point,
 * even though the value has already been through a zod enum.
 */
const TRUNC: Record<AnalyticsGranularity, string> = {
  day: "day",
  week: "week",
  month: "month",
}

/* ------------------------------------------------------------------ rows -- */

type PeriodRow = {
  period: string
  bookings: number
  revenue: string
  commission: string
}

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Bookings and money by the day they were BOOKED (rule #62).
   *
   * The day boundary is the property's own — `AT TIME ZONE p.timezone` — not
   * the server's. A hotel in Karachi closing its books at midnight local means
   * midnight local; bucketing by UTC moves five hours of every night's bookings
   * into the wrong day, and the error is invisible because the totals still add
   * up.
   */
  async salesByPeriod(input: {
    propertyIds: readonly string[]
    from: string
    to: string
    granularity: AnalyticsGranularity
  }) {
    if (input.propertyIds.length === 0) return []
    const unit = TRUNC[input.granularity]

    const result = await this.db.execute<PeriodRow>(sql`
      SELECT
        date_trunc(${unit}, b.created_at AT TIME ZONE p.timezone)::date::text AS period,
        COUNT(*) FILTER (WHERE b.status IN (${REALISED}))::int AS bookings,
        COALESCE(SUM(b.total) FILTER (WHERE b.status IN (${REALISED})), 0)::bigint AS revenue,
        COALESCE(SUM(b.commission_amount) FILTER (
          WHERE b.status IN (${REALISED}) AND b.commission_status <> 'void'
        ), 0)::bigint AS commission
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.property_id IN (${idList(input.propertyIds)})
        AND (b.created_at AT TIME ZONE p.timezone)::date >= ${input.from}::date
        AND (b.created_at AT TIME ZONE p.timezone)::date <= ${input.to}::date
      GROUP BY 1
      ORDER BY 1
    `)

    return result.rows.map((row) => ({
      period: row.period,
      bookings: row.bookings,
      revenue: Number(row.revenue),
      commission: Number(row.commission),
    }))
  }

  /**
   * The headline figures for a range, on the booking-date basis.
   *
   * Penalties are NOT here — they come from `penaltiesCaptured()`, against the
   * payments ledger. Rule #63 keeps them out of revenue anyway, and reaching
   * into `payments` from inside this aggregate would mean correlating a
   * subquery against the very rows being grouped.
   */
  async salesTotals(input: { propertyIds: readonly string[]; from: string; to: string }) {
    if (input.propertyIds.length === 0) {
      return { bookings: 0, revenue: 0, commission: 0, cancelled: 0 }
    }

    const result = await this.db.execute<{
      bookings: number
      revenue: string
      commission: string
      cancelled: number
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE b.status IN (${REALISED}))::int AS bookings,
        COALESCE(SUM(b.total) FILTER (WHERE b.status IN (${REALISED})), 0)::bigint AS revenue,
        COALESCE(SUM(b.commission_amount) FILTER (
          -- Voided commission is money the platform GAVE UP on a goodwill
          -- refund (rule #76). Counting it overstates what the platform
          -- earned, and on the partner's own screen it shows them a charge
          -- they no longer owe.
          WHERE b.status IN (${REALISED}) AND b.commission_status <> 'void'
        ), 0)::bigint AS commission,
        COUNT(*) FILTER (WHERE b.status IN ('cancelled', 'no_show'))::int AS cancelled
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.property_id IN (${idList(input.propertyIds)})
        AND (b.created_at AT TIME ZONE p.timezone)::date >= ${input.from}::date
        AND (b.created_at AT TIME ZONE p.timezone)::date <= ${input.to}::date
    `)

    const row = result.rows[0]
    return {
      bookings: row?.bookings ?? 0,
      revenue: Number(row?.revenue ?? 0),
      commission: Number(row?.commission ?? 0),
      cancelled: row?.cancelled ?? 0,
    }
  }

  /**
   * Room-nights and room revenue by the night STAYED (rule #62).
   *
   * This is what `booking_nights` exists for. Status comes from `bookings` by
   * join rather than from a copy on the ledger: a booking cancels after its
   * nights are written, and a denormalised status would be a second truth that
   * silently goes stale.
   */
  async stayNightsByProperty(input: {
    propertyIds: readonly string[]
    from: string
    to: string
  }) {
    if (input.propertyIds.length === 0) return []

    const result = await this.db.execute<{
      property_id: string
      room_nights: number
      bookings: number
      room_revenue: string
    }>(sql`
      SELECT
        n.property_id,
        COUNT(*)::int AS room_nights,
        COUNT(DISTINCT n.booking_id)::int AS bookings,
        COALESCE(SUM(n.room_revenue), 0)::bigint AS room_revenue
      FROM booking_nights n
      JOIN bookings b ON b.id = n.booking_id
      WHERE n.property_id IN (${idList(input.propertyIds)})
        AND n.date >= ${input.from}::date
        AND n.date <= ${input.to}::date
        AND b.status IN (${REALISED})
      GROUP BY n.property_id
    `)

    return result.rows.map((row) => ({
      propertyId: row.property_id,
      roomNights: row.room_nights,
      bookings: row.bookings,
      roomRevenue: Number(row.room_revenue),
    }))
  }

  /** The same, bucketed by period — the pace and trend screens. */
  async stayNightsByPeriod(input: {
    propertyIds: readonly string[]
    from: string
    to: string
    granularity: AnalyticsGranularity
  }) {
    if (input.propertyIds.length === 0) return []
    const unit = TRUNC[input.granularity]

    const result = await this.db.execute<{
      period: string
      room_nights: number
      bookings: number
      room_revenue: string
    }>(sql`
      SELECT
        date_trunc(${unit}, n.date)::date::text AS period,
        COUNT(*)::int AS room_nights,
        COUNT(DISTINCT n.booking_id)::int AS bookings,
        COALESCE(SUM(n.room_revenue), 0)::bigint AS room_revenue
      FROM booking_nights n
      JOIN bookings b ON b.id = n.booking_id
      WHERE n.property_id IN (${idList(input.propertyIds)})
        AND n.date >= ${input.from}::date
        AND n.date <= ${input.to}::date
        AND b.status IN (${REALISED})
      GROUP BY 1
      ORDER BY 1
    `)

    return result.rows.map((row) => ({
      period: row.period,
      roomNights: row.room_nights,
      bookings: row.bookings,
      roomRevenue: Number(row.room_revenue),
    }))
  }

  /**
   * Room-nights that were ON SALE — the denominator for occupancy and RevPAR.
   *
   * `sellable_units`, not `total_units`: a room closed for refurbishment was
   * never offered, and counting it would report a property as half empty for
   * doing sensible maintenance.
   *
   * The calendar is sparse, so a date with no row has never been touched by
   * either a partner or a booking. Those days are genuinely unknown rather than
   * zero — `COALESCE` to the room's `units` would invent inventory the property
   * never loaded, so they are simply absent from the denominator.
   */
  async availableNights(input: { propertyIds: readonly string[]; from: string; to: string }) {
    if (input.propertyIds.length === 0) return []

    const result = await this.db.execute<{ property_id: string; available: string }>(sql`
      SELECT r.property_id, COALESCE(SUM(i.sellable_units), 0)::bigint AS available
      FROM room_inventory i
      JOIN rooms r ON r.id = i.room_id
      WHERE r.property_id IN (${idList(input.propertyIds)})
        AND i.date >= ${input.from}::date
        AND i.date <= ${input.to}::date
        AND i.is_closed IS NOT TRUE
      GROUP BY r.property_id
    `)

    return result.rows.map((row) => ({
      propertyId: row.property_id,
      available: Number(row.available),
    }))
  }

  /** Published review averages, on the product's 1–5 scale. */
  async reviewScores(propertyIds: readonly string[]) {
    if (propertyIds.length === 0) return []

    const result = await this.db.execute<{
      property_id: string
      score: string | null
      reviews: number
    }>(sql`
      SELECT property_id, AVG(rating)::numeric(4,2) AS score, COUNT(*)::int AS reviews
      FROM reviews
      WHERE property_id IN (${idList(propertyIds)})
        AND status = 'published'
      GROUP BY property_id
    `)

    return result.rows.map((row) => ({
      propertyId: row.property_id,
      score: row.score === null ? null : Number(row.score),
      reviews: row.reviews,
    }))
  }

  /** Property names, for labelling rows the caller is already allowed to see. */
  async propertyNames(propertyIds: readonly string[]) {
    if (propertyIds.length === 0) return []
    const result = await this.db.execute<{ id: string; name: string; city: string }>(sql`
      SELECT id, name, city FROM properties WHERE id IN (${idList(propertyIds)})
    `)
    return result.rows
  }

  /**
   * The distinct cities this org sells in.
   *
   * For the demand screen (rule #67): a partner may ask about the markets they
   * actually operate in, and not about the whole map — that is the platform's
   * own asset.
   */
  async citiesFor(orgId: string, memberScope: readonly string[]): Promise<string[]> {
    const ids = await this.scopedPropertyIds(orgId, memberScope)
    if (ids.length === 0) return []

    const result = await this.db.execute<{ city: string }>(sql`
      SELECT DISTINCT city FROM properties WHERE id IN (${idList(ids)}) ORDER BY city
    `)
    return result.rows.map((row) => row.city)
  }

  /* ------------------------------------------------------- cancellations -- */

  /**
   * Why bookings fell through, and how late.
   *
   * `avg_days_before` is measured from the cancellation to the CHECK-IN, not to
   * the moment of booking: the number a property acts on is how much notice it
   * got to resell the room.
   */
  async cancellations(input: { propertyIds: readonly string[]; from: string; to: string }) {
    if (input.propertyIds.length === 0) {
      return { total: 0, noShows: 0, avgDaysBefore: null, refunded: 0, madeInRange: 0 }
    }

    const result = await this.db.execute<{
      total: number
      no_shows: number
      avg_days_before: string | null
      refunded: string
      made_in_range: number
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE b.status = 'cancelled')::int AS total,
        COUNT(*) FILTER (WHERE b.status = 'no_show')::int AS no_shows,
        AVG(b.check_in - (b.cancelled_at AT TIME ZONE p.timezone)::date)
          FILTER (WHERE b.status = 'cancelled' AND b.cancelled_at IS NOT NULL) AS avg_days_before,
        COALESCE(SUM(b.refund_amount) FILTER (WHERE b.status IN ('cancelled', 'no_show')), 0)::bigint
          AS refunded,
        COUNT(*)::int AS made_in_range
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.property_id IN (${idList(input.propertyIds)})
        AND (b.created_at AT TIME ZONE p.timezone)::date >= ${input.from}::date
        AND (b.created_at AT TIME ZONE p.timezone)::date <= ${input.to}::date
    `)

    const row = result.rows[0]
    return {
      total: row?.total ?? 0,
      noShows: row?.no_shows ?? 0,
      avgDaysBefore: row?.avg_days_before == null ? null : Number(row.avg_days_before),
      refunded: Number(row?.refunded ?? 0),
      madeInRange: row?.made_in_range ?? 0,
    }
  }

  /**
   * Cancellations grouped by the stated reason.
   *
   * The reason is free text a guest or a partner typed, so it is grouped as
   * given and capped at the ten most common. Anything rarer is noise, and
   * rendering a hundred one-off strings as a chart is worse than rendering
   * nothing.
   */
  async cancellationReasons(input: {
    propertyIds: readonly string[]
    from: string
    to: string
  }) {
    if (input.propertyIds.length === 0) return []

    const result = await this.db.execute<{
      reason: string
      count: number
      avg_days_before: string | null
    }>(sql`
      SELECT
        COALESCE(NULLIF(TRIM(b.cancellation_reason), ''), 'Not given') AS reason,
        COUNT(*)::int AS count,
        AVG(b.check_in - (b.cancelled_at AT TIME ZONE p.timezone)::date) AS avg_days_before
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.property_id IN (${idList(input.propertyIds)})
        AND b.status = 'cancelled'
        AND (b.created_at AT TIME ZONE p.timezone)::date >= ${input.from}::date
        AND (b.created_at AT TIME ZONE p.timezone)::date <= ${input.to}::date
      GROUP BY 1
      ORDER BY count DESC
      LIMIT 10
    `)

    return result.rows.map((row) => ({
      reason: row.reason,
      count: row.count,
      avgDaysBefore: row.avg_days_before == null ? null : Number(row.avg_days_before),
    }))
  }

  /** Who cancelled — the guest, the property, or the platform. */
  async cancellationActors(input: {
    propertyIds: readonly string[]
    from: string
    to: string
  }) {
    if (input.propertyIds.length === 0) return []

    const result = await this.db.execute<{ actor: string; count: number }>(sql`
      SELECT COALESCE(b.cancelled_by, 'unknown') AS actor, COUNT(*)::int AS count
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.property_id IN (${idList(input.propertyIds)})
        AND b.status IN ('cancelled', 'no_show')
        AND (b.created_at AT TIME ZONE p.timezone)::date >= ${input.from}::date
        AND (b.created_at AT TIME ZONE p.timezone)::date <= ${input.to}::date
      GROUP BY 1
      ORDER BY count DESC
    `)
    return result.rows
  }

  /**
   * What the property KEPT on bookings that fell through (rule #63).
   *
   * The two payment modes reach the same figure by opposite routes, and only
   * one of them leaves a `penalty` row behind (rule #52):
   *
   *  - **guarantee** — the guest never paid the platform, so cancelling
   *    CHARGES the saved card. That charge is a `penalty` payment, and reading
   *    it is the whole answer.
   *
   *  - **prepay** — the guest already paid in full, so cancelling REFUNDS part
   *    of it. There is no penalty row at all; the fee is simply the part that
   *    never went back.
   *
   * An earlier version of this query counted only `penalty` rows and reported
   * zero for every prepaid cancellation on the platform — which is most of
   * them. A test asserting a non-zero fee is what caught it.
   *
   * The prepay side subtracts from what was actually CAPTURED, not from
   * `bookings.total`: a booking cancelled out of `pending` never paid anything,
   * and measuring against its total would invent a fee out of a stay nobody was
   * ever charged for.
   */
  async feesRetained(input: { propertyIds: readonly string[]; from: string; to: string }) {
    if (input.propertyIds.length === 0) return 0

    const result = await this.db.execute<{ fees: string }>(sql`
      SELECT COALESCE(SUM(
        CASE
          WHEN b.payment_mode = 'guarantee' THEN pay.penalty
          ELSE GREATEST(pay.charged - COALESCE(b.refund_amount, 0), 0)
        END
      ), 0)::bigint AS fees
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(SUM(amount) FILTER (
            WHERE kind = 'penalty' AND status = 'captured'
          ), 0) AS penalty,
          COALESCE(SUM(amount) FILTER (
            WHERE kind = 'charge'
              AND status IN ('captured', 'refunded', 'partially_refunded')
          ), 0) AS charged
        FROM payments
        WHERE booking_id = b.id
      ) pay ON TRUE
      WHERE b.property_id IN (${idList(input.propertyIds)})
        AND b.status IN ('cancelled', 'no_show')
        AND (b.created_at AT TIME ZONE p.timezone)::date >= ${input.from}::date
        AND (b.created_at AT TIME ZONE p.timezone)::date <= ${input.to}::date
    `)
    return Number(result.rows[0]?.fees ?? 0)
  }

  /* ---------------------------------------------------------- book window -- */

  /**
   * Every booking's lead time, so the buckets can be computed in the domain.
   *
   * Aggregated by exact lead time rather than by bucket: the bucketing itself
   * is `bookWindowBucket()`, a tested pure function, and a `CASE` here would be
   * a second implementation of the same boundaries that nothing would notice
   * drifting.
   *
   * Room revenue comes from the ledger through a LATERAL join rather than from
   * `pricing.roomSubtotal` minus its discount. Both reach the same figure, and
   * that is the problem — "net room revenue" would then be defined twice, in
   * TypeScript and again in SQL, and only one of them would get changed.
   */
  async leadTimes(input: { propertyIds: readonly string[]; from: string; to: string }) {
    if (input.propertyIds.length === 0) return []

    const result = await this.db.execute<{
      lead_days: number
      bookings: number
      cancelled: number
      room_revenue: string
      room_nights: number
    }>(sql`
      SELECT
        GREATEST(b.check_in - (b.created_at AT TIME ZONE p.timezone)::date, 0) AS lead_days,
        COUNT(*)::int AS bookings,
        COUNT(*) FILTER (WHERE b.status IN ('cancelled', 'no_show'))::int AS cancelled,
        COALESCE(SUM(led.revenue), 0)::bigint AS room_revenue,
        COALESCE(SUM(led.nights), 0)::int AS room_nights
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(room_revenue), 0)::bigint AS revenue, COUNT(*)::int AS nights
        FROM booking_nights WHERE booking_id = b.id
      ) led ON TRUE
      WHERE b.property_id IN (${idList(input.propertyIds)})
        AND b.status <> 'pending'
        AND (b.created_at AT TIME ZONE p.timezone)::date >= ${input.from}::date
        AND (b.created_at AT TIME ZONE p.timezone)::date <= ${input.to}::date
      GROUP BY 1
      ORDER BY 1
    `)

    return result.rows.map((row) => ({
      leadDays: row.lead_days,
      bookings: row.bookings,
      cancelled: row.cancelled,
      roomRevenue: Number(row.room_revenue),
      roomNights: row.room_nights,
    }))
  }

  /* --------------------------------------------------------------- bookers -- */

  /**
   * Who books, grouped by one dimension of the booking.
   *
   * The dimension is a whitelisted column name — the caller passes a key, never
   * SQL. `guest_country`, `source` and party size are the three the screen asks
   * for, and nothing outside that set can be reached.
   */
  async bookerSegments(input: {
    propertyIds: readonly string[]
    from: string
    to: string
    dimension: "country" | "source" | "party"
  }) {
    if (input.propertyIds.length === 0) return []

    const expression =
      input.dimension === "country"
        ? sql`COALESCE(NULLIF(TRIM(b.guest_country), ''), 'Unknown')`
        : input.dimension === "source"
          ? sql`b.source`
          : sql`CASE
                  WHEN b.adults = 1 AND b.children = 0 THEN 'Solo'
                  WHEN b.adults = 2 AND b.children = 0 THEN 'Couple'
                  WHEN b.children > 0 THEN 'Family'
                  ELSE 'Group'
                END`

    const result = await this.db.execute<{
      segment: string
      bookings: number
      total_spend: string
      total_nights: number
      top_source: string
    }>(sql`
      SELECT
        ${expression} AS segment,
        COUNT(*)::int AS bookings,
        COALESCE(SUM(b.total), 0)::bigint AS total_spend,
        COALESCE(SUM(b.check_out - b.check_in), 0)::int AS total_nights,
        MODE() WITHIN GROUP (ORDER BY b.source) AS top_source
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      WHERE b.property_id IN (${idList(input.propertyIds)})
        AND b.status IN (${REALISED})
        AND (b.created_at AT TIME ZONE p.timezone)::date >= ${input.from}::date
        AND (b.created_at AT TIME ZONE p.timezone)::date <= ${input.to}::date
      GROUP BY 1
      ORDER BY bookings DESC
      LIMIT 20
    `)

    return result.rows.map((row) => ({
      segment: row.segment,
      bookings: row.bookings,
      totalSpend: Number(row.total_spend),
      totalNights: row.total_nights,
      topSource: row.top_source,
    }))
  }

  /**
   * How many guests came back.
   *
   * Counted on `customer_id`, so it only sees guests with an account — a person
   * who booked twice as a guest each time is two rows and cannot be joined up.
   * That is the honest limit of the data and the number is described as such.
   */
  async repeatGuests(input: { propertyIds: readonly string[]; from: string; to: string }) {
    if (input.propertyIds.length === 0) return { guests: 0, repeat: 0 }

    const result = await this.db.execute<{ guests: number; repeat: number }>(sql`
      WITH per_guest AS (
        SELECT b.customer_id, COUNT(*) AS bookings
        FROM bookings b
        JOIN properties p ON p.id = b.property_id
        WHERE b.property_id IN (${idList(input.propertyIds)})
          AND b.status IN (${REALISED})
          AND b.customer_id IS NOT NULL
          AND (b.created_at AT TIME ZONE p.timezone)::date >= ${input.from}::date
          AND (b.created_at AT TIME ZONE p.timezone)::date <= ${input.to}::date
        GROUP BY b.customer_id
      )
      SELECT
        COUNT(*)::int AS guests,
        COUNT(*) FILTER (WHERE bookings > 1)::int AS repeat
      FROM per_guest
    `)

    const row = result.rows[0]
    return { guests: row?.guests ?? 0, repeat: row?.repeat ?? 0 }
  }

  /* ---------------------------------------------------------------- genius -- */

  /**
   * What the Genius tier brought in, against everything else.
   *
   * A booking counts as Genius when the promotion it used was aimed at that
   * channel (rule #3) — there is no tier stamped on the booking row, and adding
   * one would be a snapshot of something that changes underneath it.
   *
   * Room revenue comes from the ledger, for the same reason as `leadTimes`:
   * one definition of what a night earned, in one place.
   */
  async geniusSplit(input: { propertyIds: readonly string[]; from: string; to: string }) {
    if (input.propertyIds.length === 0) return { genius: EMPTY_SPLIT, other: EMPTY_SPLIT }

    const result = await this.db.execute<{
      is_genius: boolean
      bookings: number
      revenue: string
      room_revenue: string
      room_nights: number
      discount: string
      guests: number
    }>(sql`
      SELECT
        (promo.channel = 'genius') AS is_genius,
        COUNT(*)::int AS bookings,
        COALESCE(SUM(b.total), 0)::bigint AS revenue,
        COALESCE(SUM(led.revenue), 0)::bigint AS room_revenue,
        COALESCE(SUM(led.nights), 0)::int AS room_nights,
        COALESCE(SUM(COALESCE((b.pricing->'discount'->>'amount')::bigint, 0)), 0)::bigint
          AS discount,
        COUNT(DISTINCT b.customer_id)::int AS guests
      FROM bookings b
      JOIN properties p ON p.id = b.property_id
      LEFT JOIN promotions promo ON promo.id = b.promotion_id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(room_revenue), 0)::bigint AS revenue, COUNT(*)::int AS nights
        FROM booking_nights WHERE booking_id = b.id
      ) led ON TRUE
      WHERE b.property_id IN (${idList(input.propertyIds)})
        AND b.status IN (${REALISED})
        AND (b.created_at AT TIME ZONE p.timezone)::date >= ${input.from}::date
        AND (b.created_at AT TIME ZONE p.timezone)::date <= ${input.to}::date
      GROUP BY 1
    `)

    let genius = EMPTY_SPLIT
    let other = EMPTY_SPLIT
    for (const row of result.rows) {
      const split = {
        bookings: row.bookings,
        revenue: Number(row.revenue),
        roomRevenue: Number(row.room_revenue),
        roomNights: row.room_nights,
        discount: Number(row.discount),
        guests: row.guests,
      }
      // `is_genius` is NULL when the booking carried no promotion at all.
      if (row.is_genius === true) genius = split
      else other = sumSplits(other, split)
    }

    return { genius, other }
  }

  /* ----------------------------------------------------------- comparables -- */

  /**
   * The market a property competes in, anonymously (rule #65).
   *
   * Returns one row PER PROPERTY in the city — deliberately without naming them
   * — so the caller can count the sample and refuse to publish below the floor.
   * Aggregating in SQL would hand back a single average with no way to tell
   * whether two properties or two hundred produced it.
   *
   * Only `active` properties count. A draft listing has no real trading data
   * and would drag a market average toward numbers nobody is achieving.
   */
  async marketByCity(input: { city: string; from: string; to: string }) {
    const result = await this.db.execute<{
      property_id: string
      room_nights: number
      room_revenue: string
      available: string
      score: string | null
    }>(sql`
      WITH city_properties AS (
        SELECT id FROM properties
        WHERE LOWER(city) = LOWER(${input.city}) AND status = 'active'
      ),
      sold AS (
        SELECT n.property_id,
               COUNT(*)::int AS room_nights,
               COALESCE(SUM(n.room_revenue), 0)::bigint AS room_revenue
        FROM booking_nights n
        JOIN bookings b ON b.id = n.booking_id
        WHERE n.property_id IN (SELECT id FROM city_properties)
          AND n.date >= ${input.from}::date AND n.date <= ${input.to}::date
          AND b.status IN (${REALISED})
        GROUP BY n.property_id
      ),
      capacity AS (
        SELECT r.property_id, COALESCE(SUM(i.sellable_units), 0)::bigint AS available
        FROM room_inventory i
        JOIN rooms r ON r.id = i.room_id
        WHERE r.property_id IN (SELECT id FROM city_properties)
          AND i.date >= ${input.from}::date AND i.date <= ${input.to}::date
          AND i.is_closed IS NOT TRUE
        GROUP BY r.property_id
      ),
      scored AS (
        SELECT property_id, AVG(rating)::numeric(4,2) AS score
        FROM reviews
        WHERE property_id IN (SELECT id FROM city_properties) AND status = 'published'
        GROUP BY property_id
      )
      SELECT
        cp.id AS property_id,
        COALESCE(s.room_nights, 0) AS room_nights,
        COALESCE(s.room_revenue, 0)::bigint AS room_revenue,
        COALESCE(c.available, 0)::bigint AS available,
        sc.score
      FROM city_properties cp
      LEFT JOIN sold s ON s.property_id = cp.id
      LEFT JOIN capacity c ON c.property_id = cp.id
      LEFT JOIN scored sc ON sc.property_id = cp.id
    `)

    return result.rows.map((row) => ({
      propertyId: row.property_id,
      roomNights: row.room_nights,
      roomRevenue: Number(row.room_revenue),
      available: Number(row.available),
      score: row.score === null ? null : Number(row.score),
    }))
  }

  /* ----------------------------------------------------------------- pace -- */

  /**
   * What was on the books for a future period, as of a given moment.
   *
   * The `asOf` cut is the whole point (rule #62). Comparing this year's
   * half-filled forward book against last year's finished one would show every
   * property in freefall every single day of the year; the only fair
   * comparison is against what last year looked like at the same distance out.
   */
  async onTheBooksAsOf(input: {
    propertyIds: readonly string[]
    from: string
    to: string
    asOf: string
    granularity: AnalyticsGranularity
  }) {
    if (input.propertyIds.length === 0) return []
    const unit = TRUNC[input.granularity]

    const result = await this.db.execute<{
      period: string
      room_nights: number
      room_revenue: string
    }>(sql`
      SELECT
        date_trunc(${unit}, n.date)::date::text AS period,
        COUNT(*)::int AS room_nights,
        COALESCE(SUM(n.room_revenue), 0)::bigint AS room_revenue
      FROM booking_nights n
      JOIN bookings b ON b.id = n.booking_id
      WHERE n.property_id IN (${idList(input.propertyIds)})
        AND n.date >= ${input.from}::date
        AND n.date <= ${input.to}::date
        AND b.status IN (${REALISED})
        AND b.created_at <= ${input.asOf}::timestamptz
      GROUP BY 1
      ORDER BY 1
    `)

    return result.rows.map((row) => ({
      period: row.period,
      roomNights: row.room_nights,
      roomRevenue: Number(row.room_revenue),
    }))
  }

  /** Available nights bucketed by period — the occupancy denominator over time. */
  async availableNightsByPeriod(input: {
    propertyIds: readonly string[]
    from: string
    to: string
    granularity: AnalyticsGranularity
  }) {
    if (input.propertyIds.length === 0) return []
    const unit = TRUNC[input.granularity]

    const result = await this.db.execute<{ period: string; available: string }>(sql`
      SELECT date_trunc(${unit}, i.date)::date::text AS period,
             COALESCE(SUM(i.sellable_units), 0)::bigint AS available
      FROM room_inventory i
      JOIN rooms r ON r.id = i.room_id
      WHERE r.property_id IN (${idList(input.propertyIds)})
        AND i.date >= ${input.from}::date
        AND i.date <= ${input.to}::date
        AND i.is_closed IS NOT TRUE
      GROUP BY 1
      ORDER BY 1
    `)

    return result.rows.map((row) => ({
      period: row.period,
      available: Number(row.available),
    }))
  }

  /**
   * The properties an org owns, narrowed to what this member may see.
   *
   * The org id comes from the session and never from the request, so there is
   * no parameter here that could be pointed at somebody else's portfolio.
   */
  async scopedPropertyIds(orgId: string, memberScope: readonly string[]) {
    const result = await this.db.execute<{ id: string }>(sql`
      SELECT id FROM properties WHERE partner_org_id = ${orgId}::uuid
    `)
    const owned = result.rows.map((r) => r.id)
    // An empty member scope means every property the org owns.
    return memberScope.length === 0 ? owned : owned.filter((id) => memberScope.includes(id))
  }

  /* ------------------------------------------------------------- platform -- */

  /**
   * Every property the platform has, for the admin scope (rule #84).
   *
   * The same engine the partner uses, with the scope taken off — not a second
   * implementation. Two copies of "what is ADR" is two answers, and they never
   * stay the same.
   */
  async allPropertyIds(orgId?: string) {
    const where = orgId ? sql`WHERE partner_org_id = ${orgId}::uuid` : sql``
    const result = await this.db.execute<{ id: string }>(sql`
      SELECT id FROM properties ${where}
    `)
    return result.rows.map((r) => r.id)
  }

  /**
   * Every partner organisation, ranked by what it brought in (rule #82).
   *
   * `gmv` is the guests' money and mostly the property's; `commission` is what
   * the PLATFORM actually earned. They are kept apart here so no screen can
   * quietly present one as the other.
   *
   * Cancelled bookings are counted separately rather than dropped: a client
   * whose bookings mostly fall through is exactly the client an operator needs
   * to see, and a list that hides them ranks them as merely quiet.
   */
  async byOrg(input: { from: string; to: string; limit: number }) {
    const result = await this.db.execute<{
      org_id: string
      org_name: string
      properties: number
      bookings: number
      cancelled: number
      gmv: string
      commission: string
    }>(sql`
      SELECT
        o.id AS org_id,
        o.name AS org_name,
        COUNT(DISTINCT p.id)::int AS properties,
        COUNT(b.id) FILTER (WHERE b.status IN (${REALISED}))::int AS bookings,
        COUNT(b.id) FILTER (WHERE b.status IN ('cancelled', 'no_show'))::int AS cancelled,
        COALESCE(SUM(b.total) FILTER (WHERE b.status IN (${REALISED})), 0)::bigint AS gmv,
        COALESCE(SUM(b.commission_amount) FILTER (
          -- Voided commission is money the platform gave up (rule #76). Counting
          -- it would report earnings that were deliberately let go.
          WHERE b.status IN (${REALISED}) AND b.commission_status <> 'void'
        ), 0)::bigint AS commission
      FROM partner_orgs o
      LEFT JOIN properties p ON p.partner_org_id = o.id
      LEFT JOIN bookings b
        ON b.property_id = p.id
       AND (b.created_at AT TIME ZONE p.timezone)::date >= ${input.from}::date
       AND (b.created_at AT TIME ZONE p.timezone)::date <= ${input.to}::date
      GROUP BY o.id, o.name
      ORDER BY commission DESC, gmv DESC
      LIMIT ${input.limit}
    `)

    return result.rows.map((row) => ({
      orgId: row.org_id,
      orgName: row.org_name,
      properties: row.properties,
      bookings: row.bookings,
      cancelled: row.cancelled,
      gmv: Number(row.gmv),
      commission: Number(row.commission),
    }))
  }

  /** How much of the marketplace is actually trading. */
  async platformShape() {
    const result = await this.db.execute<{
      orgs: number
      active_orgs: number
      properties: number
      live_properties: number
    }>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM partner_orgs) AS orgs,
        (SELECT COUNT(*)::int FROM partner_orgs WHERE status = 'active') AS active_orgs,
        (SELECT COUNT(*)::int FROM properties) AS properties,
        (SELECT COUNT(*)::int FROM properties WHERE status = 'active') AS live_properties
    `)

    const row = result.rows[0]
    return {
      orgs: Number(row?.orgs ?? 0),
      activeOrgs: Number(row?.active_orgs ?? 0),
      properties: Number(row?.properties ?? 0),
      liveProperties: Number(row?.live_properties ?? 0),
    }
  }
}

/* ------------------------------------------------------------------ local -- */

const EMPTY_SPLIT = {
  bookings: 0,
  revenue: 0,
  roomRevenue: 0,
  roomNights: 0,
  discount: 0,
  guests: 0,
}

type Split = typeof EMPTY_SPLIT

/**
 * Folds the non-Genius groups together.
 *
 * `promo.channel` is NULL for a booking with no promotion and a plain string
 * for one aimed at `all` or `mobile`, so the `GROUP BY` yields more than one
 * non-Genius row. Both are "not Genius" as far as this screen is concerned.
 */
function sumSplits(a: Split, b: Split): Split {
  return {
    bookings: a.bookings + b.bookings,
    revenue: a.revenue + b.revenue,
    roomRevenue: a.roomRevenue + b.roomRevenue,
    roomNights: a.roomNights + b.roomNights,
    discount: a.discount + b.discount,
    guests: a.guests + b.guests,
  }
}
