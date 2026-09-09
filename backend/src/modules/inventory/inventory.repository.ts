import { Inject, Injectable } from "@nestjs/common"
import type { ISODate } from "@stayora/shared"
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { properties, ratePlanRates, ratePlans, roomInventory, rooms } from "../../db/schema"

@Injectable()
export class InventoryRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Everything the availability answer needs, in THREE queries — not three per
   * room, and not one per night.
   *
   * A property with five room types and two rate plans each over a seven-night
   * stay is 70 night-resolutions. Fetching them per room would be 10 round
   * trips; per night, 70. The sparse rows come back in one sweep each and the
   * domain folds them in memory.
   */
  async loadStayContext(input: { propertyId: string; from: ISODate; to: ISODate }) {
    const roomRows = await this.db
      .select()
      .from(rooms)
      .where(eq(rooms.propertyId, input.propertyId))
      .orderBy(asc(rooms.createdAt))

    if (roomRows.length === 0) return { rooms: [], ratePlans: [], inventory: [], rates: [] }

    const roomIds = roomRows.map((r) => r.id)

    const planRows = await this.db
      .select()
      .from(ratePlans)
      .where(and(inArray(ratePlans.roomId, roomIds), eq(ratePlans.status, "active")))
      .orderBy(asc(ratePlans.basePrice))

    // Sparse: most nights have no row at all, so this usually returns far
    // fewer than rooms × nights.
    const inventoryRows = await this.db
      .select()
      .from(roomInventory)
      .where(
        and(
          inArray(roomInventory.roomId, roomIds),
          gte(roomInventory.date, input.from),
          lte(roomInventory.date, input.to)
        )
      )

    const planIds = planRows.map((p) => p.id)
    const rateRows =
      planIds.length === 0
        ? []
        : await this.db
            .select()
            .from(ratePlanRates)
            .where(
              and(
                inArray(ratePlanRates.ratePlanId, planIds),
                gte(ratePlanRates.date, input.from),
                lte(ratePlanRates.date, input.to)
              )
            )

    return { rooms: roomRows, ratePlans: planRows, inventory: inventoryRows, rates: rateRows }
  }

  /**
   * The same sources as `loadStayContext`, narrowed and owner-scoped.
   *
   * Separate from that one because a partner's view is not a guest's: it
   * includes DRAFT and ARCHIVED rate plans and archived rooms, since "why is
   * this not selling" is exactly the question the screen has to answer.
   */
  async loadCalendarContext(input: {
    propertyId: string
    from: ISODate
    to: ISODate
    roomId?: string
    ratePlanId?: string
  }) {
    const roomWhere = [eq(rooms.propertyId, input.propertyId)]
    if (input.roomId) roomWhere.push(eq(rooms.id, input.roomId))

    const roomRows = await this.db
      .select()
      .from(rooms)
      .where(and(...roomWhere))
      .orderBy(asc(rooms.name))

    if (roomRows.length === 0) return { rooms: [], ratePlans: [], inventory: [], rates: [] }

    const roomIds = roomRows.map((r) => r.id)
    const planWhere = [inArray(ratePlans.roomId, roomIds)]
    if (input.ratePlanId) planWhere.push(eq(ratePlans.id, input.ratePlanId))

    const planRows = await this.db
      .select()
      .from(ratePlans)
      .where(and(...planWhere))
      .orderBy(asc(ratePlans.basePrice))

    const inventoryRows = await this.db
      .select()
      .from(roomInventory)
      .where(
        and(
          inArray(roomInventory.roomId, roomIds),
          gte(roomInventory.date, input.from),
          lte(roomInventory.date, input.to)
        )
      )

    const planIds = planRows.map((p) => p.id)
    const rateRows =
      planIds.length === 0
        ? []
        : await this.db
            .select()
            .from(ratePlanRates)
            .where(
              and(
                inArray(ratePlanRates.ratePlanId, planIds),
                gte(ratePlanRates.date, input.from),
                lte(ratePlanRates.date, input.to)
              )
            )

    return { rooms: roomRows, ratePlans: planRows, inventory: inventoryRows, rates: rateRows }
  }

  async findPropertyBySlug(slug: string) {
    const [row] = await this.db
      .select()
      .from(properties)
      .where(and(eq(properties.slug, slug), eq(properties.status, "active")))
      .limit(1)
    return row ?? null
  }

  /* ------------------------------------------------------- partner writes -- */

  /** The rooms a partner may touch, already scoped to their org. */
  async roomsForPartner(input: { propertyId: string; orgId: string; propertyIds: string[] }) {
    const scope = [eq(properties.id, input.propertyId), eq(properties.partnerOrgId, input.orgId)]
    if (input.propertyIds.length > 0) {
      scope.push(inArray(properties.id, input.propertyIds))
    }
    return this.db
      .select({ room: rooms })
      .from(rooms)
      .innerJoin(properties, eq(properties.id, rooms.propertyId))
      .where(and(...scope))
  }

  /**
   * Opens or closes a date range for a set of rooms (rule #32).
   *
   * `UPSERT` because the calendar is sparse: most of these dates have no row
   * yet, and the row has to exist before it can carry a flag. `total_units`
   * and `sellable_units` are seeded from the room at creation, which is what
   * lets the overbooking CHECK work at row level.
   *
   * Existing BOOKINGS are untouched. Closing a date stops new reservations; it
   * does not cancel the ones already sold.
   */
  async setClosed(input: {
    roomIds: string[]
    from: ISODate
    to: ISODate
    isClosed: boolean
  }): Promise<number> {
    if (input.roomIds.length === 0) return 0

    const result = await this.db.execute(sql`
      INSERT INTO ${roomInventory} (room_id, date, is_closed, total_units, sellable_units, booked_units)
      SELECT r.id, d::date, ${input.isClosed}, r.units, r.units, 0
      FROM ${rooms} r
      CROSS JOIN generate_series(${input.from}::date, ${input.to}::date, '1 day') AS d
      WHERE r.id IN ${input.roomIds}
      ON CONFLICT (room_id, date) DO UPDATE
        SET is_closed = EXCLUDED.is_closed,
            updated_at = now()
    `)
    return result.rowCount ?? 0
  }

  /** Sets rate and restrictions across a date range for one rate plan. */
  async setRates(input: {
    ratePlanId: string
    from: ISODate
    to: ISODate
    patch: {
      rate?: number | null
      minStay?: number | null
      minStayThrough?: number | null
      maxStay?: number | null
      closedToArrival?: boolean | null
      closedToDeparture?: boolean | null
      minAdvanceHours?: number | null
    }
  }): Promise<number> {
    const p = input.patch

    /*
     * Omitted and `null` are DIFFERENT, and the contract promises they are.
     *
     * This used to be `rate = COALESCE(EXCLUDED.rate, rate)` for every column,
     * which collapses the two: a field left out arrived as NULL, a field sent
     * as `null` arrived as NULL, and COALESCE kept the old value either way.
     * The effect was that nothing already set could ever be UNSET — a partner
     * who priced a night by mistake, or set a two-night minimum they no longer
     * wanted, had no way back to the plan's own value. "Clear it" is not a
     * nicety here: a restriction that cannot be removed silently keeps
     * refusing bookings.
     *
     * So only the columns actually sent are assigned, and for those EXCLUDED
     * is taken verbatim — including when it is NULL, which is the clear.
     */
    const assignments = [
      p.rate !== undefined ? sql`rate = EXCLUDED.rate` : null,
      p.minStay !== undefined ? sql`min_stay = EXCLUDED.min_stay` : null,
      p.minStayThrough !== undefined
        ? sql`min_stay_through = EXCLUDED.min_stay_through`
        : null,
      p.maxStay !== undefined ? sql`max_stay = EXCLUDED.max_stay` : null,
      p.closedToArrival !== undefined
        ? sql`closed_to_arrival = EXCLUDED.closed_to_arrival`
        : null,
      p.closedToDeparture !== undefined
        ? sql`closed_to_departure = EXCLUDED.closed_to_departure`
        : null,
      p.minAdvanceHours !== undefined
        ? sql`min_advance_hours = EXCLUDED.min_advance_hours`
        : null,
    ].filter((part) => part !== null)

    /*
     * An empty patch touches nothing, rather than inserting rows of NULLs.
     *
     * A date with no row means "fall back to the rate plan" (rule #23); a row
     * of NULLs resolves to the same numbers but is no longer a fallback, and
     * a copy would then carry that explicit nothing onto its target.
     */
    if (assignments.length === 0) return 0

    const result = await this.db.execute(sql`
      INSERT INTO ${ratePlanRates}
        (rate_plan_id, date, rate, min_stay, min_stay_through, max_stay,
         closed_to_arrival, closed_to_departure, min_advance_hours)
      SELECT ${input.ratePlanId}::uuid, d::date,
             ${p.rate ?? null}, ${p.minStay ?? null}, ${p.minStayThrough ?? null},
             ${p.maxStay ?? null}, ${p.closedToArrival ?? null},
             ${p.closedToDeparture ?? null}, ${p.minAdvanceHours ?? null}
      FROM generate_series(${input.from}::date, ${input.to}::date, '1 day') AS d
      ON CONFLICT (rate_plan_id, date) DO UPDATE SET
        ${sql.join(assignments, sql`, `)},
        updated_at = now()
    `)
    return result.rowCount ?? 0
  }

  /**
   * Copying a stretch of calendar onto another stretch (rule #100).
   *
   * Done entirely in SQL: read the source days, map each onto a target day by
   * its offset, and upsert. Pulling a year of rows into JavaScript to write
   * them back one at a time is 365 round trips for something Postgres does in
   * one statement — and leaves the calendar half-copied if it fails partway.
   *
   * The source range REPEATS across a longer target. Copying a typical week
   * over a season is the reason this screen exists; refusing unless the two
   * ranges are the same length would make the common case the hard one.
   *
   * Two different kinds of "nothing", handled differently on purpose:
   *
   *  - a source day with NO ROW is skipped by the JOIN, so the matching target
   *    day is left exactly as it was. A sparse calendar means "fall back to
   *    the rate plan" (rule #23), and writing a row of NULLs would replace
   *    that fallback with an explicit nothing.
   *  - a source day WITH a row whose columns are NULL overwrites the target,
   *    clearing it. That is what copying means: afterwards the target reads
   *    the way the source does, restrictions included.
   */
  async copyRates(input: {
    sourceRatePlanId: string
    targetRatePlanId: string
    sourceFrom: ISODate
    sourceTo: ISODate
    targetFrom: ISODate
    targetTo: ISODate
  }): Promise<number> {
    const result = await this.db.execute(sql`
      WITH source AS (
        SELECT (date - ${input.sourceFrom}::date) AS offset_days,
               rate, min_stay, min_stay_through, max_stay,
               closed_to_arrival, closed_to_departure, min_advance_hours
        FROM rate_plan_rates
        WHERE rate_plan_id = ${input.sourceRatePlanId}::uuid
          AND date >= ${input.sourceFrom}::date
          AND date <= ${input.sourceTo}::date
      ),
      span AS (
        SELECT (${input.sourceTo}::date - ${input.sourceFrom}::date + 1) AS len
      ),
      target AS (
        SELECT d::date AS date,
               ((d::date - ${input.targetFrom}::date) % (SELECT len FROM span)) AS offset_days
        FROM generate_series(${input.targetFrom}::date, ${input.targetTo}::date, '1 day') AS d
      )
      INSERT INTO rate_plan_rates
        (rate_plan_id, date, rate, min_stay, min_stay_through, max_stay,
         closed_to_arrival, closed_to_departure, min_advance_hours)
      SELECT ${input.targetRatePlanId}::uuid, t.date,
             s.rate, s.min_stay, s.min_stay_through, s.max_stay,
             s.closed_to_arrival, s.closed_to_departure, s.min_advance_hours
      FROM target t
      JOIN source s ON s.offset_days = t.offset_days
      ON CONFLICT (rate_plan_id, date) DO UPDATE SET
        rate = EXCLUDED.rate,
        min_stay = EXCLUDED.min_stay,
        min_stay_through = EXCLUDED.min_stay_through,
        max_stay = EXCLUDED.max_stay,
        closed_to_arrival = EXCLUDED.closed_to_arrival,
        closed_to_departure = EXCLUDED.closed_to_departure,
        min_advance_hours = EXCLUDED.min_advance_hours,
        updated_at = now()
    `)
    return result.rowCount ?? 0
  }

  /** A rate plan scoped to the caller's org. Not theirs → not found. */
  async findRatePlanForPartner(input: {
    ratePlanId: string
    orgId: string
    propertyIds: string[]
  }) {
    const scope = [eq(ratePlans.id, input.ratePlanId), eq(properties.partnerOrgId, input.orgId)]
    if (input.propertyIds.length > 0) {
      scope.push(inArray(properties.id, input.propertyIds))
    }
    const [row] = await this.db
      .select({ ratePlan: ratePlans, room: rooms, property: properties })
      .from(ratePlans)
      .innerJoin(rooms, eq(rooms.id, ratePlans.roomId))
      .innerJoin(properties, eq(properties.id, rooms.propertyId))
      .where(and(...scope))
      .limit(1)
    return row ?? null
  }
}
