import { sql } from "drizzle-orm"
import {
  check,
  date,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { users } from "./auth"
import { bookings } from "./bookings"
import { properties } from "./catalog"
import { enumColumn, primaryId, timestamps } from "./_shared"

/* ============================================================================
 * Module 6 — reviews.
 * ========================================================================== */

/**
 * Moderation states (rule #40).
 *
 * `published` is the DEFAULT, not the reward at the end of a queue. A review
 * can only be written against a `completed` booking, so the writer demonstrably
 * paid, stayed and left — which is the strongest anti-spam signal there is, and
 * it is enforced before a word is typed.
 *
 * The safety valve is `flagged`: a partner objects, the review leaves the
 * public site and the rating immediately, and an admin decides. That bounds
 * the damage window without putting a human in front of every honest review.
 *
 * `pending` exists for the automated screen that will route suspicious text
 * here later. Nothing sets it today — pretending otherwise would be a screening
 * claim with no screening behind it.
 *
 * `withdrawn` is the AUTHOR taking their own review down. Kept apart from
 * `rejected` because "the guest removed this" and "we removed this" are
 * different facts, and only one of them is a moderation decision. The row
 * stays, and so does the unique index over `booking_id`: withdrawing is not a
 * do-over. Otherwise take-it-down-and-write-a-nicer-one becomes a lever a
 * property can lean on a guest to pull.
 */
export const REVIEW_STATUSES = [
  "published",
  "pending",
  "flagged",
  "rejected",
  "withdrawn",
] as const

export const reviews = pgTable(
  "reviews",
  {
    id: primaryId(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),

    /**
     * The stay this review came from. Its presence IS the Verified badge.
     *
     * `set null` rather than cascade: deleting a booking must not silently
     * erase a published review and move the property's rating.
     */
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),
    /** `null` for imported / OTA reviews, which have no account behind them. */
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),

    /** Snapshot of the display name at the time of writing. */
    author: varchar("author", { length: 160 }).notNull(),
    authorSeed: varchar("author_seed", { length: 64 }).notNull().default(""),
    country: varchar("country", { length: 80 }).notNull().default(""),
    roomName: varchar("room_name", { length: 120 }).notNull().default(""),

    /** 1–5. The only rating scale in the product. */
    rating: smallint("rating").notNull(),
    /** The five sub-scores, each 1–5. Validated by the contract on the way in. */
    categories: jsonb("categories").notNull(),

    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    date: date("date").notNull(),

    status: enumColumn("status").notNull().default("published"),
    /**
     * Why a moderator flagged or rejected it.
     *
     * The admin panel had this and the core types did not, so a moderation
     * decision carried no reason at all — and nobody could tell a mistake from
     * a judgement call afterwards.
     */
    flagReason: text("flag_reason"),

    /* -------------------------------------------------------- response -- */
    responseText: text("response_text"),
    responseAt: timestamp("response_at", { withTimezone: true, mode: "string" }),

    ...timestamps,
  },
  (t) => [
    /**
     * One review per booking (rule #39).
     *
     * A plain UNIQUE is enough even though imported reviews carry no booking:
     * Postgres treats NULLs as distinct, so any number of them coexist while
     * two reviews can never share a real booking id. (Verified — not assumed:
     * `NULL != NULL` is the whole reason this works, and it is the opposite of
     * how a UNIQUE behaves in some other engines.)
     */
    unique("reviews_booking_unique").on(t.bookingId),

    // The property page: published reviews, newest first.
    index("reviews_property_status_idx").on(t.propertyId, t.status, t.date),
    index("reviews_author_idx").on(t.authorId),

    check("reviews_rating_check", sql`${t.rating} >= 1 AND ${t.rating} <= 5`),
    check(
      "reviews_status_check",
      sql`${t.status} IN ('published', 'pending', 'flagged', 'rejected', 'withdrawn')`
    ),
    /**
     * A response is a pair: text and the moment it was written. Half of one is
     * how a screen ends up rendering "responded on Invalid Date".
     */
    check(
      "reviews_response_consistency",
      sql`(${t.responseText} IS NULL AND ${t.responseAt} IS NULL)
          OR (${t.responseText} IS NOT NULL AND ${t.responseAt} IS NOT NULL)`
    ),
  ]
)
