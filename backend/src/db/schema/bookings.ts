import { sql } from "drizzle-orm"
import {
  check,
  date,
  index,
  integer,
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
import { properties, ratePlans, rooms, valueAdds } from "./catalog"
import { promotions } from "./promotions"
import { enumColumn, primaryId, timestamps } from "./_shared"

/* ============================================================================
 * Module 5 — bookings.
 * ========================================================================== */

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "no_show",
  "cancelled",
] as const

export const BOOKING_SOURCES = ["direct", "booking_com", "expedia", "travel_agency"] as const
/** Rule #42. The old `card | property` pair is gone — see `payments.ts`. */
export const PAYMENT_MODES = ["prepay", "guarantee"] as const
export const COMMISSION_STATUSES = ["pending", "earned", "void"] as const
export const CANCELLED_BY = ["guest", "property", "admin"] as const
export const REFUND_STATUSES = ["full", "partial", "none", "pending", "processed"] as const

export const bookings = pgTable(
  "bookings",
  {
    /** Internal key. Never shown to a guest. */
    id: primaryId(),

    /**
     * Guest-facing reference, `STY-XXXXXX`. A SEPARATE column from the primary
     * key — in the prototype the ref WAS the id, so changing the scheme would
     * have meant changing every foreign key.
     */
    ref: varchar("ref", { length: 16 }).notNull(),

    /**
     * ALWAYS set for a booking made on the site — an account is required to
     * check out (rule #29). `null` only for a walk-in the property enters
     * itself, a phone booking, or an OTA import.
     *
     * `onDelete: set null` rather than cascade: deleting an account must not
     * erase the property's record of a stay that happened.
     */
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "set null" }),

    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "restrict" }),
    /** Which product was sold — price and cancellation both came from it. */
    ratePlanId: uuid("rate_plan_id")
      .notNull()
      .references(() => ratePlans.id, { onDelete: "restrict" }),

    /** Snapshots, so history survives catalogue edits. */
    propertyName: varchar("property_name", { length: 160 }).notNull(),
    roomName: varchar("room_name", { length: 120 }).notNull(),
    ratePlanName: varchar("rate_plan_name", { length: 120 }).notNull(),
    city: varchar("city", { length: 120 }).notNull().default(""),
    seed: varchar("seed", { length: 64 }).notNull().default(""),

    /**
     * The cancellation TERMS as they stood at booking. Frozen: a partner
     * tightening the policy tomorrow must not shrink a refund somebody already
     * agreed to.
     */
    cancelFreeUntil: enumColumn("cancel_free_until").notNull(),
    cancelCharge: enumColumn("cancel_charge").notNull(),
    cancelChargeValue: smallint("cancel_charge_value"),
    /**
     * The no-show terms, frozen the same way (rule #47).
     *
     * `NULL` means the cancellation terms applied. Snapshotting matters more
     * here than anywhere: a property that turns "no-show" strict next month
     * must not reach back and charge a guest who never agreed to it.
     */
    noShowCharge: enumColumn("no_show_charge"),
    noShowChargeValue: smallint("no_show_charge_value"),

    guestFirstName: varchar("guest_first_name", { length: 80 }).notNull(),
    guestLastName: varchar("guest_last_name", { length: 80 }).notNull(),
    guestEmail: varchar("guest_email", { length: 254 }).notNull(),
    guestPhone: varchar("guest_phone", { length: 32 }).notNull().default(""),
    guestCountry: varchar("guest_country", { length: 80 }).notNull().default(""),

    checkIn: date("check_in").notNull(),
    checkOut: date("check_out").notNull(),

    /** Split adults/children (rule #28), never one `guests` number. */
    adults: smallint("adults").notNull(),
    children: smallint("children").notNull().default(0),

    arrivalTime: varchar("arrival_time", { length: 40 }).notNull().default(""),
    specialRequests: text("special_requests").notNull().default(""),

    /**
     * The frozen price block. JSONB because it is a SNAPSHOT, not something to
     * query or recompute — every figure the booking will ever show comes from
     * here, exactly as it was agreed.
     */
    pricing: jsonb("pricing").notNull(),
    /** Denormalised from `pricing.total` so money can be summed in SQL. */
    total: integer("total").notNull(),

    /** Which offer produced the discount, if any. */
    promotionId: uuid("promotion_id").references(() => promotions.id, { onDelete: "set null" }),

    /**
     * Snapshot of the rate plan's payment mode (rule #42).
     *
     * Snapshotted for the same reason the cancellation terms are: a partner
     * switching a rate plan to `prepay` next month must not retroactively mean
     * that last month's guest owed the money up front.
     *
     * There is deliberately no `payment_status` beside it. That fact lives in
     * the `payments` table, which is where the money is — a copy here would be
     * a second answer to "was this paid", free to disagree with the ledger.
     */
    paymentMode: enumColumn("payment_mode").notNull().default("prepay"),


    /** Snapshot of the org's rate — renegotiating must not rewrite the past. */
    commissionRateBps: integer("commission_rate_bps").notNull(),
    commissionAmount: integer("commission_amount").notNull(),
    commissionStatus: enumColumn("commission_status").notNull().default("pending"),

    status: enumColumn("status").notNull().default("confirmed"),
    source: enumColumn("source").notNull().default("direct"),

    /**
     * When a `pending` hold lapses. Non-null ONLY while `status` is `pending`.
     *
     * Pending bookings hold inventory, so without an expiry a script could open
     * reservations it never pays for and take a property off sale (API6). The
     * flow that creates them arrives with payments in Module 7.
     */
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true, mode: "string" }),

    roomNo: varchar("room_no", { length: 20 }),
    /** Property-side note. Never shown to the guest. */
    notes: text("notes"),

    /* ------------------------------------------------------ cancellation -- */
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, mode: "string" }),
    cancelledBy: enumColumn("cancelled_by"),
    cancellationReason: text("cancellation_reason"),
    refundAmount: integer("refund_amount"),
    refundStatus: enumColumn("refund_status"),

    ...timestamps,
  },
  (t) => [
    unique("bookings_ref_unique").on(t.ref),
    // "My bookings", newest first.
    index("bookings_customer_idx").on(t.customerId, t.createdAt),
    // The partner's arrivals board.
    index("bookings_property_checkin_idx").on(t.propertyId, t.checkIn),
    // The cron that expires holds and sweeps no-shows.
    index("bookings_status_idx").on(t.status),
    // Inventory release on cancel walks this.
    index("bookings_room_dates_idx").on(t.roomId, t.checkIn, t.checkOut),

    check("bookings_status_check", sql`${t.status} IN ('pending', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled')`),
    check("bookings_source_check", sql`${t.source} IN ('direct', 'booking_com', 'expedia', 'travel_agency')`),
    check("bookings_payment_mode_check", sql`${t.paymentMode} IN ('prepay', 'guarantee')`),
    check(
      "bookings_no_show_charge_check",
      sql`${t.noShowCharge} IS NULL OR ${t.noShowCharge} IN ('first_night', 'percent', 'full')`
    ),
    /** `IS DISTINCT FROM` — a NULL-valued CHECK passes. See the rate plan. */
    check(
      "bookings_no_show_value_check",
      sql`(${t.noShowCharge} = 'percent'
             AND ${t.noShowChargeValue} IS NOT NULL
             AND ${t.noShowChargeValue} BETWEEN 1 AND 100)
          OR (${t.noShowCharge} IS DISTINCT FROM 'percent' AND ${t.noShowChargeValue} IS NULL)`
    ),
    check("bookings_commission_status_check", sql`${t.commissionStatus} IN ('pending', 'earned', 'void')`),
    check("bookings_cancelled_by_check", sql`${t.cancelledBy} IS NULL OR ${t.cancelledBy} IN ('guest', 'property', 'admin')`),
    check("bookings_refund_status_check", sql`${t.refundStatus} IS NULL OR ${t.refundStatus} IN ('full', 'partial', 'none', 'pending', 'processed')`),

    check("bookings_dates_check", sql`${t.checkOut} > ${t.checkIn}`),
    check("bookings_adults_check", sql`${t.adults} >= 1`),
    check("bookings_children_check", sql`${t.children} >= 0`),
    check("bookings_total_check", sql`${t.total} >= 0`),
    check("bookings_commission_check", sql`${t.commissionAmount} >= 0`),

    /**
     * A cancelled booking must carry its cancellation, and a live one must not.
     *
     * Both sides matter: half-written cancellation data is how a refund gets
     * paid twice, or never.
     */
    check(
      "bookings_cancellation_consistency",
      sql`(${t.status} = 'cancelled' AND ${t.cancelledAt} IS NOT NULL AND ${t.cancelledBy} IS NOT NULL)
          OR (${t.status} <> 'cancelled' AND ${t.cancelledAt} IS NULL)`
    ),

    /** A hold expiry belongs to a `pending` booking and nothing else. */
    check(
      "bookings_hold_consistency",
      sql`(${t.status} = 'pending' AND ${t.holdExpiresAt} IS NOT NULL)
          OR (${t.status} <> 'pending' AND ${t.holdExpiresAt} IS NULL)`
    ),
  ]
)

export const bookingAddOns = pgTable(
  "booking_add_ons",
  {
    id: primaryId(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    valueAddId: uuid("value_add_id").references(() => valueAdds.id, { onDelete: "set null" }),

    /** Snapshots — the extra may be renamed or retired later. */
    name: varchar("name", { length: 120 }).notNull(),
    unit: enumColumn("unit").notNull(),
    unitPrice: integer("unit_price").notNull(),
    qty: smallint("qty").notNull().default(1),
    /** `resolvedUnitPrice × qty` for this stay's nights and party size. */
    amount: integer("amount").notNull(),

    ...timestamps,
  },
  (t) => [
    index("booking_add_ons_booking_idx").on(t.bookingId),
    check("booking_add_ons_qty_check", sql`${t.qty} >= 1`),
    check("booking_add_ons_amount_check", sql`${t.amount} >= 0`),
  ]
)

export const BOOKING_ACTORS = [
  "guest",
  "partner_admin",
  "partner_manager",
  "partner_staff",
  "platform_admin",
  "system",
] as const

/**
 * Append-only audit of every status change.
 *
 * Answers "who cancelled this, when, and why" — which the prototype could not,
 * because `setBookingStatus` overwrote the field with no guard and no record.
 *
 * Partner roles are prefixed: `PartnerRole` already contains `admin`, and an
 * unprefixed union would store the platform's admin and a property's own admin
 * under the same value, indistinguishable in exactly the trail that exists to
 * distinguish them.
 */
export const bookingEvents = pgTable(
  "booking_events",
  {
    id: primaryId(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),

    fromStatus: enumColumn("from_status"),
    toStatus: enumColumn("to_status").notNull(),

    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actor: enumColumn("actor").notNull(),
    reason: text("reason"),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("booking_events_booking_idx").on(t.bookingId, t.createdAt),
    check("booking_events_actor_check", sql`${t.actor} IN ('guest', 'partner_admin', 'partner_manager', 'partner_staff', 'platform_admin', 'system')`),
  ]
)

/**
 * Idempotency records for booking creation.
 *
 * A double-submitted checkout must produce ONE reservation. The key is scoped
 * to the user so one caller cannot replay another's key, and the response is
 * stored so the retry gets the same answer rather than a confusing conflict.
 */
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    key: varchar("key", { length: 128 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The booking the first call produced. */
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    /** Hash of the request body — a reused key with different data is a bug. */
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("idempotency_keys_user_key_unique").on(t.userId, t.key),
    index("idempotency_keys_created_idx").on(t.createdAt),
  ]
)
