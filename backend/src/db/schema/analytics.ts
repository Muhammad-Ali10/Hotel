import { sql } from "drizzle-orm"
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { bookings } from "./bookings"
import { properties, ratePlans, rooms } from "./catalog"
import { users } from "./auth"
import { enumColumn, primaryId } from "./_shared"

/* ============================================================================
 * Module 10 — analytics (rules #62–#68).
 * ========================================================================== */

/**
 * One row per booking, per night — the stay-date ledger (rule #62).
 *
 * Every stay-date metric needs this and none of them can be had without it. A
 * stay from 30 March to 2 April is two nights of March revenue and one of
 * April, and no `GROUP BY check_in` will ever produce that split.
 *
 * The revenue could be recovered at query time from `bookings.pricing`, which
 * carries `nightlyRates` as a JSONB array — unnesting it with ordinality
 * against a `generate_series` of the stay's dates. That works, and it does not
 * survive volume: every dashboard would re-derive the same arithmetic over
 * every booking ever taken, and the promotion discount would have to be
 * re-apportioned each time. Writing it once, where the booking transaction is
 * already looping over these exact dates to move `booked_units`, costs a single
 * multi-row insert and turns every later question into `SUM` over an index.
 *
 * `property_id` is denormalised from the booking so the common grouping never
 * needs the join, and `status` deliberately is NOT — a booking's status changes
 * after these rows are written, and a copy here would be a second truth to keep
 * in step. Analytics joins `bookings` for it.
 */
export const bookingNights = pgTable(
  "booking_nights",
  {
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),

    /** The night STAYED — check-out day is not a night and has no row. */
    date: date("date").notNull(),

    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    ratePlanId: uuid("rate_plan_id")
      .notNull()
      .references(() => ratePlans.id, { onDelete: "cascade" }),

    /**
     * This night's share of the room revenue, in cents, net of promotion
     * (rules #62, #64).
     *
     * Room only — no add-ons. A hotel that counts breakfast in its ADR prices
     * upward from a rate it never achieved.
     *
     * `allocateNightly()` guarantees these sum to exactly the booking's
     * `roomSubtotal − discount`, so this table and the payout statement can
     * never drift apart by a rounding cent.
     */
    roomRevenue: integer("room_revenue").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One row per booking per night. Also the key a modify rewrites against.
    primaryKey({ columns: [t.bookingId, t.date] }),

    // THE analytics index: every stay-date question is a property over a range.
    index("booking_nights_property_date_idx").on(t.propertyId, t.date),
    index("booking_nights_room_date_idx").on(t.roomId, t.date),

    // Revenue is never negative; a discount larger than the stay yields zero.
    check("booking_nights_revenue_check", sql`${t.roomRevenue} >= 0`),
  ]
)

/* ------------------------------------------------------------ search events */

export const SEARCH_SURFACES = ["web", "mobile_web", "app"] as const

/**
 * What people looked for (rules #67, #68).
 *
 * Written from today even though the Demand screen is not built yet, because
 * analytics does not backfill: a table added the same week as its screen shows
 * an empty chart for the first quarter of its life, and the one question a
 * partner asks — "was last winter busier?" — is the one it cannot answer.
 *
 * Deliberately thin on the person. A hashed session id and, if they were signed
 * in, a user id. **No IP address and no user agent** (rule #68): "how much
 * demand is there for Lahore in December" is answerable without identifying
 * anybody, and a column that does not exist cannot appear in a breach.
 */
export const searchEvents = pgTable(
  "search_events",
  {
    id: primaryId(),

    /** Free text as typed, lower-cased — the city vocabulary is not closed. */
    destination: varchar("destination", { length: 160 }).notNull(),

    checkIn: date("check_in"),
    checkOut: date("check_out"),
    adults: smallint("adults"),
    children: smallint("children"),

    /** How many properties came back — zero is the interesting case. */
    resultCount: integer("result_count").notNull().default(0),

    surface: enumColumn("surface").notNull().default("web"),

    /**
     * A hashed, rotating session id — enough to tell one visitor's five
     * searches from five visitors' one, and not enough to follow anybody.
     */
    sessionHash: varchar("session_hash", { length: 64 }),

    /** Present only when the searcher was signed in. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // "Demand for this destination over this period" — the whole screen.
    index("search_events_destination_created_idx").on(t.destination, t.createdAt),
    index("search_events_created_idx").on(t.createdAt),
    check(
      "search_events_surface_check",
      sql`${t.surface} IN ('web', 'mobile_web', 'app')`
    ),
    check("search_events_result_count_check", sql`${t.resultCount} >= 0`),
    /*
     * Dates arrive as a pair or not at all, and a stay is at least one night.
     *
     * Written as `(a IS NULL) = (b IS NULL)` rather than the obvious
     * `(a IS NULL AND b IS NULL) OR (a IS NOT NULL AND b > a)`. That reading
     * looks equivalent and is not: with a check-in and a NULL check-out,
     * `b > a` is NULL, `true AND NULL` is NULL, and **a CHECK that evaluates
     * to NULL passes**. The half-filled pair was accepted — proved against the
     * database before this comment was written.
     *
     * Comparing two `IS NULL` booleans can never itself be NULL, and the
     * second clause short-circuits on the NULL case it would otherwise hit.
     */
    check(
      "search_events_dates_check",
      sql`(${t.checkIn} IS NULL) = (${t.checkOut} IS NULL)
          AND (${t.checkOut} IS NULL OR ${t.checkOut} > ${t.checkIn})`
    ),
  ]
)

/**
 * Which properties a search actually showed, and where (rule #67).
 *
 * The Ranking screen's two questions live here: what position did we appear at,
 * and how often did being seen turn into a click. Neither is recoverable after
 * the fact — a search result page is gone the moment it is rendered.
 *
 * One row per property per search, written as a single multi-row insert so a
 * twenty-result page costs one round trip. High-volume by nature: the index is
 * built for the rollup this will eventually need, and the table is a candidate
 * for monthly partitioning long before it is a problem.
 */
export const searchImpressions = pgTable(
  "search_impressions",
  {
    searchEventId: uuid("search_event_id")
      .notNull()
      .references(() => searchEvents.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),

    /** 1-based position on the results page. */
    position: smallint("position").notNull(),

    /**
     * Set when the searcher opened this property.
     *
     * A nullable timestamp rather than a boolean: "did they click" and "how
     * long did they take to click" are the same column this way, and the second
     * question is the one that separates a listing people consider from one
     * they scroll past.
     */
    clickedAt: timestamp("clicked_at", { withTimezone: true, mode: "string" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.searchEventId, t.propertyId] }),
    // "My position and conversion over this period" — the Ranking screen.
    index("search_impressions_property_created_idx").on(t.propertyId, t.createdAt),
    check("search_impressions_position_check", sql`${t.position} >= 1`),
  ]
)
