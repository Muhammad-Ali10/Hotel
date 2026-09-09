import { sql } from "drizzle-orm"
import { check, date, index, integer, pgTable, primaryKey, smallint, uuid, varchar } from "drizzle-orm/pg-core"

import { partnerOrgs } from "./auth"
import { properties, rooms } from "./catalog"
import { enumColumn, primaryId, timestamps } from "./_shared"

/* ============================================================================
 * Module 4 — promotions.
 * ========================================================================== */

export const DISCOUNT_TYPES = ["percent", "amount", "free_night"] as const

export const PROMOTION_STATUSES = ["draft", "scheduled", "active", "paused", "ended"] as const

/**
 * Which audience a promotion reaches (rule #3).
 *
 * `mobile` is derived from the user agent and is therefore SPOOFABLE — a
 * desktop caller can claim to be a phone (rule #35). That is accepted rather
 * than papered over: every OTA has the same hole, changing a user agent is
 * friction enough for almost everyone, and the alternative is pretending to
 * enforce something we cannot. `genius` comes from the session and is real.
 */
export const PROMOTION_CHANNELS = ["all", "mobile", "genius"] as const

export const PROMOTION_KINDS = [
  "seasonal_deal",
  "limited_time",
  "member_exclusive",
  "group_booking",
  "early_bird",
  "last_minute",
  "flash",
  /*
   * The two `boost` screens, as marketing labels (rule #16).
   *
   * Neither needs any pricing machinery: `long_stay` is a promotion with a
   * `min_stay`, `genius` is one on the `genius` channel, and both of those
   * already work. The label is what the screen groups by — it does NOT change
   * how the discount is calculated, and nothing in pricing reads it.
   */
  "long_stay",
  "genius",
] as const

export const promotions = pgTable(
  "promotions",
  {
    id: primaryId(),

    /** The org that owns it. Platform-wide promotions have none. */
    partnerOrgId: uuid("partner_org_id").references(() => partnerOrgs.id, { onDelete: "cascade" }),

    name: varchar("name", { length: 160 }).notNull(),
    /** Marketing categorisation only (rule #16). Pricing never reads it. */
    kind: enumColumn("kind").notNull().default("seasonal_deal"),

    discountType: enumColumn("discount_type").notNull(),
    /**
     * Means something different per type, so it is always read WITH the type:
     *  - `percent`     → 15 = 15% off the room subtotal
     *  - `amount`      → CENTS off, capped at the room subtotal
     *  - `free_night`  → 3 = every 3rd night free (the cheapest ones, rule #19)
     */
    discountValue: integer("discount_value").notNull(),

    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),

    /** Minimum nights for the offer to apply (rule #22). */
    minStay: smallint("min_stay"),

    channel: enumColumn("channel").notNull().default("all"),
    status: enumColumn("status").notNull().default("draft"),

    ...timestamps,
  },
  (t) => [
    index("promotions_status_dates_idx").on(t.status, t.startDate, t.endDate),
    index("promotions_org_idx").on(t.partnerOrgId),
    check(
      "promotions_discount_type_check",
      sql`${t.discountType} IN ('percent', 'amount', 'free_night')`
    ),
    check(
      "promotions_status_check",
      sql`${t.status} IN ('draft', 'scheduled', 'active', 'paused', 'ended')`
    ),
    check("promotions_channel_check", sql`${t.channel} IN ('all', 'mobile', 'genius')`),
    check(
      "promotions_kind_check",
      sql`${t.kind} IN (
        'seasonal_deal', 'limited_time', 'member_exclusive', 'group_booking',
        'early_bird', 'last_minute', 'flash', 'long_stay', 'genius'
      )`
    ),
    check("promotions_window_check", sql`${t.endDate} >= ${t.startDate}`),
    check("promotions_min_stay_check", sql`${t.minStay} IS NULL OR ${t.minStay} >= 1`),
    // A percentage above 100 would make the room free and then some. The other
    // types are bounded by the subtotal at calculation time instead.
    check(
      "promotions_discount_value_check",
      sql`${t.discountValue} > 0
          AND (${t.discountType} <> 'percent' OR ${t.discountValue} <= 100)`
    ),
  ]
)

export const promotionProperties = pgTable(
  "promotion_properties",
  {
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.promotionId, t.propertyId] }),
    // "Which promotions cover this property" — the pricing path runs this way.
    index("promotion_properties_property_idx").on(t.propertyId),
  ]
)

/**
 * Room-level targeting (rule #21).
 *
 * NO rows for a promotion = every room of every listed property. The prototype
 * held this as free text — `"Standard rooms"` — which no code could evaluate,
 * so a promotion labelled for standard rooms discounted the suites too.
 */
export const promotionRooms = pgTable(
  "promotion_rooms",
  {
    promotionId: uuid("promotion_id")
      .notNull()
      .references(() => promotions.id, { onDelete: "cascade" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.promotionId, t.roomId] }),
    index("promotion_rooms_room_idx").on(t.roomId),
  ]
)
