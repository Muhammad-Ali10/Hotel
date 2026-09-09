import { sql } from "drizzle-orm"
import {
  check,
  type AnyPgColumn,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { bookings } from "./bookings"
import { enumColumn, primaryId, timestamps } from "./_shared"

/* ============================================================================
 * Module 7 — payments (rules #42–#46).
 * ========================================================================== */

export const PAYMENT_KINDS = ["charge", "guarantee", "penalty"] as const

export const PAYMENT_STATUSES = [
  "requires_payment_method",
  "requires_action",
  "authorized",
  "captured",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const

/**
 * One attempt to move money, or to prove that money could be moved.
 *
 * A booking accumulates these over its life: the original charge or guarantee,
 * then a penalty when the guest cancels late, then refunds against either. The
 * rows are never rewritten to mean something else — a payment is a record of
 * something that happened, and editing history is how a refund gets paid twice.
 */
export const payments = pgTable(
  "payments",
  {
    id: primaryId(),

    /**
     * `no action`, not cascade and not set null.
     *
     * A booking with money attached must not be deletable at all: cascading
     * would erase the evidence of a charge, and orphaning it would leave money
     * in the ledger belonging to nobody. The database refuses the delete.
     */
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "no action" }),

    /**
     * The guarantee this penalty is charged against.
     *
     * Self-referencing, and enforced: a penalty pointing at a payment that was
     * never taken is how a charge ends up with no card behind it.
     */
    parentPaymentId: uuid("parent_payment_id").references((): AnyPgColumn => payments.id, {
      onDelete: "no action",
    }),

    kind: enumColumn("kind").notNull(),
    status: enumColumn("status").notNull().default("requires_payment_method"),

    /** Cents. `0` for a guarantee — the card is verified, not charged. */
    amount: integer("amount").notNull(),
    amountRefunded: integer("amount_refunded").notNull().default(0),
    /** Rule #12 says USD only; storing it anyway, because adding it later is worse. */
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),

    /* ------------------------------------------------------- the provider -- */

    /**
     * Which adapter created this row.
     *
     * Recorded per payment, not read from config at refund time: a provider
     * switch must not send a refund for last month's charge to a processor
     * that never took it (rule #43).
     */
    provider: varchar("provider", { length: 32 }).notNull(),
    /** The provider's id for the intent. Null only in the instant before it exists. */
    providerRef: varchar("provider_ref", { length: 128 }),
    /**
     * The saved card, for charging a penalty or a no-show later.
     *
     * A reference held by the provider — never a card number, never a CVV.
     * Nothing in this system is PCI scope, and this column is the reason why.
     */
    providerMethodRef: varchar("provider_method_ref", { length: 128 }),

    /** Enough to recognise a card on a screen, useless to whoever steals it. */
    cardBrand: varchar("card_brand", { length: 24 }),
    cardLast4: varchar("card_last4", { length: 4 }),

    failureReason: text("failure_reason"),
    capturedAt: timestamp("captured_at", { withTimezone: true, mode: "string" }),

    ...timestamps,
  },
  (t) => [
    /**
     * At most ONE live primary payment per booking.
     *
     * Partial, so a failed attempt does not block the retry: the guest's card
     * is declined, that row settles on `failed`, and a fresh intent can be
     * created. What it does prevent is two live intents for the same booking —
     * which is how a guest gets charged twice for one stay.
     */
    uniqueIndex("payments_one_live_primary")
      .on(t.bookingId)
      .where(
        sql`kind IN ('charge', 'guarantee') AND status NOT IN ('failed', 'cancelled')`
      ),

    unique("payments_provider_ref_unique").on(t.provider, t.providerRef),
    index("payments_booking_idx").on(t.bookingId, t.createdAt),
    index("payments_status_idx").on(t.status),

    check("payments_kind_check", sql`${t.kind} IN ('charge', 'guarantee', 'penalty')`),
    check(
      "payments_status_check",
      sql`${t.status} IN ('requires_payment_method', 'requires_action', 'authorized',
                          'captured', 'failed', 'cancelled', 'refunded', 'partially_refunded')`
    ),

    /** Money never goes backwards, and a refund never exceeds what was taken. */
    check("payments_amount_check", sql`${t.amount} >= 0`),
    check(
      "payments_refund_check",
      sql`${t.amountRefunded} >= 0 AND ${t.amountRefunded} <= ${t.amount}`
    ),

    /**
     * A guarantee moves nothing; a charge and a penalty must move something.
     *
     * Without this, a `charge` of 0 would confirm a booking for free and read
     * as perfectly normal in every list.
     */
    check(
      "payments_kind_amount_check",
      sql`(${t.kind} = 'guarantee' AND ${t.amount} = 0)
          OR (${t.kind} <> 'guarantee' AND ${t.amount} > 0)`
    ),

    /** A captured payment carries the moment it was captured, and only then. */
    check(
      "payments_captured_consistency",
      sql`(${t.status} IN ('captured', 'refunded', 'partially_refunded') AND ${t.capturedAt} IS NOT NULL)
          OR (${t.status} NOT IN ('captured', 'refunded', 'partially_refunded') AND ${t.capturedAt} IS NULL)`
    ),
  ]
)

/**
 * Provider callbacks that have already been handled (rule #45).
 *
 * Providers retry until they get a 2xx, and they are not fussy about sending
 * the same event twice regardless. The unique key on the provider's own event
 * id is what makes a replayed `payment.captured` a no-op instead of a second
 * confirmation — and it is a table rather than an in-memory set because the
 * retry usually arrives at a different instance, or after a deploy.
 */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: primaryId(),
    provider: varchar("provider", { length: 32 }).notNull(),
    /** The provider's event id. */
    eventId: varchar("event_id", { length: 128 }).notNull(),
    type: varchar("type", { length: 64 }).notNull(),
    paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),

    /**
     * The translated event, kept for reconciliation.
     *
     * Not the raw provider body: that can carry more of a person's payment
     * profile than this system has any reason to hold, and it would sit in the
     * database for years.
     */
    payload: jsonb("payload").notNull(),

    ...timestamps,
  },
  (t) => [
    unique("payment_events_provider_event_unique").on(t.provider, t.eventId),
    index("payment_events_payment_idx").on(t.paymentId),
  ]
)
