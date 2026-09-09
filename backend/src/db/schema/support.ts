import { sql } from "drizzle-orm"
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { partnerOrgs, users } from "./auth"
import { bookings } from "./bookings"
import { enumColumn, primaryId, timestamps } from "./_shared"

/* ============================================================================
 * Module 13 — support (rules #85–#90).
 * ========================================================================== */

export const SUPPORT_AUDIENCES = ["guest", "partner"] as const
export const SUPPORT_STATUSES = ["open", "in_progress", "resolved"] as const
export const SUPPORT_PRIORITIES = ["low", "medium", "high"] as const

/**
 * A conversation with the platform (rules #85–#88).
 *
 * ONE table for both audiences, because the mechanics are identical — a
 * thread, its messages, a status, an assignee, a resolution. Two tables would
 * be two implementations of the same thing, and the second one rots.
 *
 * The difference is `audience`, and it is not a label: every query's scope is
 * built from it. A partner's thread discusses commission, payouts and the
 * contract, and must never be reachable from a guest's session.
 */
export const supportThreads = pgTable(
  "support_threads",
  {
    id: primaryId(),

    /** Human-readable, for a guest to quote on the phone. */
    ref: varchar("ref", { length: 16 }).notNull(),

    audience: enumColumn("audience").notNull(),

    /**
     * Who asked. NULL for an anonymous ticket (rule #85).
     *
     * `set null` rather than cascade: a closed account must not erase the
     * conversation, which may be the only record of why something was refunded.
     */
    requesterId: uuid("requester_id").references(() => users.id, { onDelete: "set null" }),

    /**
     * Where the answer goes.
     *
     * Always present, even when `requester_id` is — a person can open a ticket
     * from one account and want the reply somewhere they can actually read it.
     * It is also the only handle an anonymous ticket has.
     */
    requesterEmail: varchar("requester_email", { length: 254 }).notNull(),
    requesterName: varchar("requester_name", { length: 160 }).notNull().default(""),

    /**
     * The org, for a partner thread (rule #88).
     *
     * What makes the thread visible to that org's colleagues rather than only
     * to the person who opened it — a hotel's conversation with the platform
     * belongs to the hotel, not to whoever happened to type it.
     */
    orgId: uuid("org_id").references(() => partnerOrgs.id, { onDelete: "cascade" }),

    /**
     * The booking this is about, when there is one.
     *
     * Never set on an anonymous thread (rule #85): attaching a booking to a
     * ticket opened by an unproven email address is handing somebody else's
     * reservation to whoever asked for it.
     */
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "set null" }),

    subject: varchar("subject", { length: 200 }).notNull(),
    /** Free text, whitelisted per audience in the contract — the two differ. */
    category: varchar("category", { length: 64 }).notNull().default("general"),
    priority: enumColumn("priority").notNull().default("medium"),
    status: enumColumn("status").notNull().default("open"),

    /** The platform person who owns it. NULL means nobody has picked it up. */
    assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),

    /** Set once, when the thread is resolved. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "string" }),

    /**
     * When the requester last said something.
     *
     * Kept as its own column so a queue can be ordered by "waiting longest for
     * us" — which is the only ordering support actually works from. Deriving it
     * would mean a correlated subquery on every row of every listing.
     */
    lastMessageAt: timestamp("last_message_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),

    ...timestamps,
  },
  (t) => [
    index("support_threads_ref_idx").on(t.ref),
    // The platform's queue: open threads, oldest wait first.
    index("support_threads_queue_idx").on(t.status, t.lastMessageAt),
    // "My tickets" and "our org's tickets" — the two scoped reads.
    index("support_threads_requester_idx").on(t.requesterId, t.createdAt),
    index("support_threads_org_idx").on(t.orgId, t.createdAt),
    index("support_threads_email_idx").on(t.requesterEmail),

    check("support_threads_audience_check", sql`${t.audience} IN ('guest', 'partner')`),
    check(
      "support_threads_status_check",
      sql`${t.status} IN ('open', 'in_progress', 'resolved')`
    ),
    check("support_threads_priority_check", sql`${t.priority} IN ('low', 'medium', 'high')`),
    /*
     * A partner thread has an org; a guest thread does not.
     *
     * Written as an equality of two boolean tests so it can never evaluate to
     * NULL — the trap that let a half-filled date pair into `search_events`
     * until the database was asked about it directly.
     */
    check(
      "support_threads_org_matches_audience",
      sql`(${t.audience} = 'partner') = (${t.orgId} IS NOT NULL)`
    ),
    /*
     * An anonymous thread carries no booking (rule #85).
     *
     * The one structural guarantee behind "a ticket from an unproven address
     * shows no account data" — without it, the rule lives only in whichever
     * service happens to remember it.
     */
    check(
      "support_threads_anonymous_has_no_booking",
      sql`${t.requesterId} IS NOT NULL OR ${t.bookingId} IS NULL`
    ),
    // Resolved and only resolved carries a resolution time.
    check(
      "support_threads_resolved_consistency",
      sql`(${t.status} = 'resolved') = (${t.resolvedAt} IS NOT NULL)`
    ),
  ]
)

/**
 * What was said, and by whom.
 *
 * Append-only in practice (rule #90): nothing in the API edits or deletes a
 * message. Support conversations are evidence in a dispute, and evidence that
 * can be changed afterwards is not evidence. The answer to a mistake is the
 * next message, not erasing the last one.
 */
export const supportMessages = pgTable(
  "support_messages",
  {
    id: primaryId(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => supportThreads.id, { onDelete: "cascade" }),

    /**
     * Which side spoke.
     *
     * `internal` is a note the requester never sees — where an agent writes
     * "this is the third refund this month" without saying it to the guest.
     */
    authorKind: enumColumn("author_kind").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    /** Snapshotted, so a departed colleague's messages stay readable. */
    authorName: varchar("author_name", { length: 160 }).notNull().default(""),

    body: text("body").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("support_messages_thread_idx").on(t.threadId, t.createdAt),
    check(
      "support_messages_author_kind_check",
      sql`${t.authorKind} IN ('requester', 'agent', 'internal')`
    ),
    check("support_messages_body_check", sql`length(trim(${t.body})) > 0`),
  ]
)

/* -------------------------------------------------------- booking messages */

/**
 * A guest and a property talking about one booking (rule #89).
 *
 * NOT support, and deliberately its own table. There is no category here, no
 * priority, no assignee and no resolution — a stay ends and the conversation
 * simply stops. Folding it into `support_threads` would leave half those
 * columns permanently null and make every support query remember to exclude it.
 *
 * The platform is not a participant. It can read one for a dispute, which is
 * what `admin/reservations` is for, but it does not answer.
 */
export const bookingMessages = pgTable(
  "booking_messages",
  {
    id: primaryId(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),

    /** `guest` or `property` — the only two who speak here. */
    authorSide: enumColumn("author_side").notNull(),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    authorName: varchar("author_name", { length: 160 }).notNull().default(""),

    body: text("body").notNull(),

    /**
     * When the OTHER side read it.
     *
     * One column rather than two, because there are exactly two parties: a
     * message from the guest is read by the property and vice versa. A general
     * read-receipts table would be three joins for a question with one answer.
     */
    readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("booking_messages_booking_idx").on(t.bookingId, t.createdAt),
    check("booking_messages_side_check", sql`${t.authorSide} IN ('guest', 'property')`),
    check("booking_messages_body_check", sql`length(trim(${t.body})) > 0`),
  ]
)
