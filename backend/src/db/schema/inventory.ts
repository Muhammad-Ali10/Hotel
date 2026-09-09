import { sql } from "drizzle-orm"
import { boolean, check, date, index, integer, pgTable, primaryKey, smallint, uuid } from "drizzle-orm/pg-core"

import { ratePlans, rooms } from "./catalog"
import { timestamps } from "./_shared"

/* ============================================================================
 * Module 3 — the two sparse calendars.
 *
 * They are separate on purpose. Inventory belongs to the ROOM: "Flexible" and
 * "Non-refundable" sell out of the same 28 Deluxe Kings, and giving each plan
 * its own counter would let a property sell 56. Price and stay restrictions
 * belong to the PLAN: the same night is $725 flexible and $620 non-refundable.
 *
 * Both are SPARSE — a row exists only where a date actually has something to
 * say. Materialising every room × every date would be ~58M mostly-empty rows
 * at 10,000 properties, almost all of them repeating a default.
 * See docs/ARCHITECTURE.md §3.
 * ========================================================================== */

/**
 * Physical stock for one room type on one date.
 *
 * This table is where overbooking is actually prevented. Everything in
 * `shared/domain/availability.ts` is advisory — by the time it answers, the
 * snapshot it read is already stale. The `CHECK` below is not.
 */
export const roomInventory = pgTable(
  "room_inventory",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    date: date("date").notNull(),

    /** `null` → open. Closing a room closes it on every rate plan. */
    isClosed: boolean("is_closed"),

    /**
     * Physical rooms of this type, copied from `rooms.units` when the row is
     * created. Reporting reads this; the overbooking guard does not.
     */
    totalUnits: smallint("total_units").notNull(),

    /**
     * How many may actually be sold. Today ALWAYS equal to `total_units`
     * (rule #25) — deliberate overbooking is not enabled.
     *
     * A separate column so that enabling an allowance later is a DATA change
     * rather than a migration on a `CHECK` over a live, large table.
     */
    sellableUnits: smallint("sellable_units").notNull(),

    bookedUnits: smallint("booked_units").notNull().default(0),

    ...timestamps,
  },
  (t) => [
    // Composite PK, date second: the booking transaction locks a contiguous
    // date range for one room, which this index serves as a range scan. It is
    // also what makes `PARTITION BY RANGE (date)` possible later without a
    // rewrite.
    primaryKey({ columns: [t.roomId, t.date] }),

    /**
     * THE overbooking guard.
     *
     * Two guests can both be told "1 room left" and both be right — the read
     * is always stale. This constraint is evaluated at write time, inside the
     * transaction, holding a row lock. It is the only thing in the system that
     * can actually say no.
     */
    check(
      "room_inventory_no_overbooking",
      sql`${t.bookedUnits} >= 0 AND ${t.bookedUnits} <= ${t.sellableUnits}`
    ),
    check("room_inventory_sellable_check", sql`${t.sellableUnits} >= 0`),
    check("room_inventory_total_check", sql`${t.totalUnits} >= 0`),
  ]
)

/**
 * Price and stay restrictions for one rate plan on one date.
 *
 * Every column is nullable: `null` means "use the plan's default". That is what
 * keeps the table sparse — a row is written only when a date genuinely differs.
 */
export const ratePlanRates = pgTable(
  "rate_plan_rates",
  {
    ratePlanId: uuid("rate_plan_id")
      .notNull()
      .references(() => ratePlans.id, { onDelete: "cascade" }),
    date: date("date").notNull(),

    /** CENTS. `null` → `rate_plans.base_price`. */
    rate: integer("rate"),

    /** Minimum nights when a stay STARTS here — MinLOS (rule #26). */
    minStay: smallint("min_stay"),

    /**
     * Minimum nights for any stay COVERING this date (rule #26).
     *
     * Arrival-only rules are trivially bypassed: a Friday–Saturday three-night
     * minimum does nothing if the guest checks in on Thursday, where the
     * minimum is one.
     */
    minStayThrough: smallint("min_stay_through"),

    /** Longest stay that may start here. `null` → the plan's default. */
    maxStay: smallint("max_stay"),

    /**
     * Closed to Arrival — the room may be occupied, but a stay may not BEGIN
     * on this date. A Sunday CTA stops one-night tails breaking up a weekend.
     */
    closedToArrival: boolean("closed_to_arrival"),

    /** Closed to Departure — a stay may not END on this date. */
    closedToDeparture: boolean("closed_to_departure"),

    /** Hours of notice a booking needs. `null` → none. */
    minAdvanceHours: smallint("min_advance_hours"),

    ...timestamps,
  },
  (t) => [
    primaryKey({ columns: [t.ratePlanId, t.date] }),
    index("rate_plan_rates_date_idx").on(t.date),
    check("rate_plan_rates_rate_check", sql`${t.rate} IS NULL OR ${t.rate} >= 0`),
    check("rate_plan_rates_min_stay_check", sql`${t.minStay} IS NULL OR ${t.minStay} >= 1`),
    check(
      "rate_plan_rates_min_stay_through_check",
      sql`${t.minStayThrough} IS NULL OR ${t.minStayThrough} >= 1`
    ),
    check("rate_plan_rates_max_stay_check", sql`${t.maxStay} IS NULL OR ${t.maxStay} >= 1`),
    check(
      "rate_plan_rates_min_advance_check",
      sql`${t.minAdvanceHours} IS NULL OR ${t.minAdvanceHours} >= 0`
    ),
    // A maximum below the minimum makes the date unbookable by its own rules.
    // `IS NOT NULL` on both sides is load-bearing: a CHECK passes on NULL, so
    // omitting it would let the pair through unchecked whenever either is unset.
    check(
      "rate_plan_rates_stay_range_check",
      sql`${t.minStay} IS NULL OR ${t.maxStay} IS NULL OR ${t.maxStay} >= ${t.minStay}`
    ),
  ]
)
