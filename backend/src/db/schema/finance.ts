import { sql } from "drizzle-orm"
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { partnerOrgs } from "./auth"
import { bookings } from "./bookings"
import { enumColumn, primaryId, timestamps } from "./_shared"

/* ============================================================================
 * Module 8 — finance (rules #48–#52).
 * ========================================================================== */

export const PAYOUT_DIRECTIONS = ["payout", "invoice", "carry"] as const
export const PAYOUT_STATUSES = ["pending", "processing", "paid", "failed"] as const
export const PAYOUT_ACCOUNT_STATUSES = ["unverified", "verified", "disabled"] as const

/**
 * Where a property's money is sent.
 *
 * There is no account number here, and no sort code. Those are held by the
 * payment provider, which is already the thing that has to move the money, and
 * a reference to them is all this system needs. Storing the real digits would
 * make this database a target worth attacking and this product's problem to
 * secure — for no capability it does not already have.
 */
export const partnerPayoutAccounts = pgTable(
  "partner_payout_accounts",
  {
    id: primaryId(),
    partnerOrgId: uuid("partner_org_id")
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: "cascade" }),

    provider: varchar("provider", { length: 32 }).notNull(),
    /** The provider's handle on the destination account. */
    providerAccountRef: varchar("provider_account_ref", { length: 128 }).notNull(),

    /** Enough to recognise the account on a screen, useless to anyone else. */
    holderName: varchar("holder_name", { length: 160 }).notNull().default(""),
    last4: varchar("last4", { length: 4 }).notNull().default(""),
    bankName: varchar("bank_name", { length: 120 }).notNull().default(""),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),

    /**
     * Money only leaves to a `verified` account.
     *
     * An unverified one is a string somebody typed. Paying against it is how a
     * transfer lands in the wrong bank and cannot be recalled.
     */
    status: enumColumn("status").notNull().default("unverified"),

    ...timestamps,
  },
  (t) => [
    /** One destination per org — "which account did it go to" must have an answer. */
    unique("partner_payout_accounts_org_unique").on(t.partnerOrgId),
    check(
      "partner_payout_accounts_status_check",
      sql`${t.status} IN ('unverified', 'verified', 'disabled')`
    ),
  ]
)

/**
 * One settlement of one period for one property (rule #48).
 *
 * Not always an outgoing transfer. On `guarantee` rates the guest paid the
 * property directly, so the commission flows the other way — a period can come
 * out negative, and that is an invoice rather than a payout (rule #52).
 */
export const payouts = pgTable(
  "payouts",
  {
    id: primaryId(),
    partnerOrgId: uuid("partner_org_id")
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: "restrict" }),

    /** Inclusive, both ends. The 1st–15th, or the 16th–end of month. */
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),

    /** What the platform collected for this property in the period. */
    grossAmount: integer("gross_amount").notNull(),
    /** What the platform earned on it. */
    commissionAmount: integer("commission_amount").notNull(),
    /** Last period's unpaid remainder, brought forward (rule #50). */
    carryIn: integer("carry_in").notNull().default(0),
    /**
     * SIGNED, and that is the point.
     *
     * Positive: owed to the property. Negative: owed to the platform. An
     * unsigned column here would need a separate "which way" flag that nothing
     * stops disagreeing with the number beside it.
     */
    netAmount: integer("net_amount").notNull(),

    direction: enumColumn("direction").notNull(),
    status: enumColumn("status").notNull().default("pending"),

    provider: varchar("provider", { length: 32 }).notNull().default(""),
    providerRef: varchar("provider_ref", { length: 128 }),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),
    failureReason: text("failure_reason"),

    ...timestamps,
  },
  (t) => [
    /**
     * One run per property per period, ever.
     *
     * A payout job that fires twice — a retry, two instances, a manual
     * re-run — must produce one row, not two. This is the constraint that
     * makes the whole run safe to repeat.
     */
    unique("payouts_org_period_unique").on(t.partnerOrgId, t.periodStart),
    index("payouts_status_idx").on(t.status, t.periodStart),

    check("payouts_direction_check", sql`${t.direction} IN ('payout', 'invoice', 'carry')`),
    check(
      "payouts_status_check",
      sql`${t.status} IN ('pending', 'processing', 'paid', 'failed')`
    ),
    check("payouts_period_check", sql`${t.periodEnd} >= ${t.periodStart}`),
    check("payouts_gross_check", sql`${t.grossAmount} >= 0 AND ${t.commissionAmount} >= 0`),

    /**
     * The arithmetic, enforced by the database.
     *
     * `net = gross − commission + carryIn`. A payout row whose total does not
     * follow from its own parts is unauditable, and the moment one exists
     * nobody can tell which of the four numbers is the wrong one.
     */
    check(
      "payouts_net_check",
      sql`${t.netAmount} = ${t.grossAmount} - ${t.commissionAmount} + ${t.carryIn}`
    ),

    /** The direction has to agree with the sign it claims to describe. */
    check(
      "payouts_direction_sign_check",
      sql`(${t.direction} = 'invoice' AND ${t.netAmount} < 0)
          OR (${t.direction} <> 'invoice' AND ${t.netAmount} >= 0)`
    ),

    /** Paid means paid: a moment, and a reference from the provider. */
    check(
      "payouts_paid_consistency",
      sql`(${t.status} = 'paid' AND ${t.paidAt} IS NOT NULL)
          OR (${t.status} <> 'paid' AND ${t.paidAt} IS NULL)`
    ),
  ]
)

/**
 * The bookings a payout is made of.
 *
 * Every payout has to be answerable down to the stay: "why is this figure
 * $184,875" is a question a property will ask, and a total with no lines
 * behind it cannot answer it.
 */
export const payoutItems = pgTable(
  "payout_items",
  {
    id: primaryId(),
    payoutId: uuid("payout_id")
      .notNull()
      .references(() => payouts.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),

    grossAmount: integer("gross_amount").notNull(),
    commissionAmount: integer("commission_amount").notNull(),
    /** Signed, for the same reason as the parent. */
    netAmount: integer("net_amount").notNull(),

    ...timestamps,
  },
  (t) => [
    /**
     * A booking is paid out ONCE. Ever.
     *
     * The single most important constraint in this module. Two runs covering
     * overlapping periods, a manual re-run, a period boundary computed wrong —
     * every one of them ends with the same stay counted twice, and the money
     * has already left before anyone reconciles the difference.
     */
    unique("payout_items_booking_unique").on(t.bookingId),
    index("payout_items_payout_idx").on(t.payoutId),

    check(
      "payout_items_net_check",
      sql`${t.netAmount} = ${t.grossAmount} - ${t.commissionAmount}`
    ),
    check(
      "payout_items_gross_check",
      sql`${t.grossAmount} >= 0 AND ${t.commissionAmount} >= 0`
    ),
  ]
)

/* ============================================================ invoices -- */

export const INVOICE_STATES = ["issued", "paid", "overdue", "void"] as const

/**
 * The month's commission bill (rules #91, #94, #95).
 *
 * Only for orgs on `invoice`, and for every `guarantee` booking regardless —
 * on those the platform never received the money, so there was nothing to hold
 * back and billing is the only route (rule #93).
 *
 * A separate cycle from payouts on purpose: payouts run fortnightly (rule #48)
 * and invoices monthly. Paying somebody and asking them for money do not have
 * to happen on the same day, and a monthly bill is the thing an accounts
 * department actually reads.
 */
export const commissionInvoices = pgTable(
  "commission_invoices",
  {
    id: primaryId(),
    /** `INV-2026-08-000123` — the period is in the reference deliberately. */
    ref: varchar("ref", { length: 32 }).notNull(),

    partnerOrgId: uuid("partner_org_id")
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: "restrict" }),

    /** The month billed, as its first day. */
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),

    /**
     * The gross the commission was computed from.
     *
     * Stored rather than derived so the partner can check the bill against
     * their own records. An invoice somebody cannot verify is one they query
     * instead of paying.
     */
    grossAmount: integer("gross_amount").notNull(),
    /** What is owed, in cents. */
    amount: integer("amount").notNull(),
    bookingCount: integer("booking_count").notNull().default(0),

    currency: varchar("currency", { length: 3 }).notNull().default("USD"),

    status: enumColumn("status").notNull().default("issued"),
    dueDate: date("due_date").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true, mode: "string" }),

    /** How it was settled, for the operator who has to reconcile it. */
    paymentNote: text("payment_note").notNull().default(""),

    ...timestamps,
  },
  (t) => [
    unique("commission_invoices_ref_unique").on(t.ref),
    /*
     * One invoice per org per period, ever.
     *
     * The monthly run is a cron, and a cron that fires twice — a retry, two
     * instances, somebody running it by hand — would otherwise bill the same
     * month again. The database is what makes that impossible.
     */
    unique("commission_invoices_period_unique").on(t.partnerOrgId, t.periodStart),
    index("commission_invoices_org_idx").on(t.partnerOrgId, t.periodStart),
    index("commission_invoices_due_idx").on(t.status, t.dueDate),

    check(
      "commission_invoices_status_check",
      sql`${t.status} IN ('issued', 'paid', 'overdue', 'void')`
    ),
    check("commission_invoices_amount_check", sql`${t.amount} >= 0 AND ${t.grossAmount} >= 0`),
    check("commission_invoices_period_check", sql`${t.periodEnd} >= ${t.periodStart}`),
    // Paid and only paid carries a payment time.
    check(
      "commission_invoices_paid_consistency",
      sql`(${t.status} = 'paid') = (${t.paidAt} IS NOT NULL)`
    ),
  ]
)

/**
 * Which bookings made up an invoice.
 *
 * The working, shown. Every line is a booking the partner can look up, so the
 * bill can be checked rather than taken on trust — "you owe us $2,400" with no
 * detail is the slowest possible way to be paid.
 */
export const commissionInvoiceLines = pgTable(
  "commission_invoice_lines",
  {
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => commissionInvoices.id, { onDelete: "cascade" }),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "restrict" }),

    /** Snapshotted, so the line still reads if the booking is later changed. */
    bookingRef: varchar("booking_ref", { length: 16 }).notNull(),
    total: integer("total").notNull(),
    commission: integer("commission").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.invoiceId, t.bookingId] }),
    /*
     * A booking is billed ONCE, ever — the same guarantee `payout_items` gives
     * on the paying side. Without it a re-run bills the same stay twice, and
     * the partner is the one who notices.
     */
    unique("commission_invoice_lines_booking_unique").on(t.bookingId),
    index("commission_invoice_lines_invoice_idx").on(t.invoiceId),
  ]
)
