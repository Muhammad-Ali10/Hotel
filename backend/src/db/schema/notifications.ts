import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  primaryKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { users } from "./auth"
import { enumColumn, primaryId, timestamps } from "./_shared"

/* ============================================================================
 * Module 9 — notifications (rules #55-#58).
 * ========================================================================== */

/**
 * What a person sees in their own dashboard.
 *
 * Separate from the outbox because the two answer different questions. This
 * one is "what has happened on my account", and it is read months later. The
 * outbox is "what still needs sending", and its rows are done with in seconds.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: primaryId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** The catalogue key. Never renamed, only deprecated. */
    template: varchar("template", { length: 64 }).notNull(),
    /** The dashboard's own grouping, so it can filter without a lookup table. */
    kind: enumColumn("kind").notNull(),
    audience: enumColumn("audience").notNull(),

    title: varchar("title", { length: 200 }).notNull(),
    message: text("message").notNull(),
    /** In-app link to whatever this is about. */
    href: varchar("href", { length: 300 }),

    readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),

    ...timestamps,
  },
  (t) => [
    // The dashboard reads "mine, newest first", and counts the unread ones.
    index("notifications_user_idx").on(t.userId, t.createdAt),
    index("notifications_unread_idx").on(t.userId, t.readAt),
    check(
      "notifications_kind_check",
      sql`${t.kind} IN ('booking', 'offer', 'review', 'system', 'message')`
    ),
    check(
      "notifications_audience_check",
      sql`${t.audience} IN ('customer', 'partner', 'admin')`
    ),
  ]
)

export const OUTBOX_STATUSES = ["pending", "sent", "failed", "suppressed"] as const

/**
 * Messages waiting to leave (rule #57).
 *
 * The row is written in the SAME transaction as the event it describes, and a
 * worker sends it afterwards. That is what stops SendGrid being able to fail a
 * booking: the confirmation is a fact recorded in the database the moment the
 * booking is, and delivery is a separate problem with its own retries.
 */
export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: primaryId(),
    /** Null for a message to an address with no account behind it. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),

    template: varchar("template", { length: 64 }).notNull(),
    channel: enumColumn("channel").notNull().default("email"),

    /**
     * What this message is ABOUT — a booking id, a payout id, a reset id.
     *
     * Paired with the template it is the identity of the event, which is what
     * makes "send this once" enforceable by the database rather than by every
     * caller remembering to check first.
     */
    dedupeKey: varchar("dedupe_key", { length: 200 }).notNull(),

    /** Snapshotted: an address change must not redirect a message already queued. */
    toEmail: varchar("to_email", { length: 254 }).notNull(),

    /**
     * Everything the template needs, frozen at enqueue time.
     *
     * Not a set of ids to look up at send time: by then the booking may have
     * been modified, and the guest would be sent a confirmation describing a
     * stay they no longer have.
     */
    payload: jsonb("payload").notNull(),

    status: enumColumn("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    /** When the worker may try again. Exponential backoff. */
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "string" }),

    /** The provider's id for the message, for tracing a complaint back. */
    providerRef: varchar("provider_ref", { length: 128 }),

    ...timestamps,
  },
  (t) => [
    /**
     * One event, one message.
     *
     * A booking is confirmed once, however many times a webhook is redelivered
     * or a job re-runs. Without this the guest receives the same email four
     * times and stops trusting any of them.
     */
    unique("notification_outbox_dedupe_unique").on(t.template, t.dedupeKey),
    // The worker's only query: what is due.
    index("notification_outbox_due_idx").on(t.status, t.nextAttemptAt),
    check("notification_outbox_channel_check", sql`${t.channel} IN ('email', 'in_app', 'sms')`),
    check(
      "notification_outbox_status_check",
      sql`${t.status} IN ('pending', 'sent', 'failed', 'suppressed')`
    ),
    check("notification_outbox_attempts_check", sql`${t.attempts} >= 0`),
    /** Sent means sent: a moment, and nothing pretending to be one. */
    check(
      "notification_outbox_sent_consistency",
      sql`(${t.status} = 'sent' AND ${t.sentAt} IS NOT NULL)
          OR (${t.status} <> 'sent' AND ${t.sentAt} IS NULL)`
    ),
  ]
)

/**
 * What each person has chosen to receive (rule #56).
 *
 * A row per user rather than columns on `users`: preferences grow, and every
 * new channel would otherwise be a migration on the busiest table in the
 * product. Absent means the defaults apply.
 */
export const notificationSettings = pgTable("notification_settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),

  emailUseful: boolean("email_useful").notNull().default(true),
  /** Off until asked for. Opt-in is the only honest default. */
  emailMarketing: boolean("email_marketing").notNull().default(false),
  /**
   * Reserved. NOT exposed by the API and never read by `maySend`.
   *
   * SMS is not a `NotificationChannel`, so a switch for it could only ever be
   * decoration. The column is kept rather than dropped so the day an adapter
   * lands there is somewhere to put the answer — but nothing offers the choice
   * until then (rule #106).
   */
  smsUseful: boolean("sms_useful").notNull().default(false),

  ...timestamps,
})

/**
 * One switch, for one message, on one channel (rule #105).
 *
 * Sparse on purpose: a missing row means "whatever this message's class
 * decides", which is what everybody gets until they change something. Storing
 * every template against every channel for every account would be thousands of
 * rows saying exactly what the defaults already say.
 *
 * Separate from `notification_settings` rather than more columns on it: the
 * coarse switches are three facts about a person, and this is a set that grows
 * every time a template is added. One would have needed a migration per
 * message.
 */
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** A `NotificationTemplate`. Not a foreign key — the catalogue is code. */
    template: varchar("template", { length: 64 }).notNull(),
    channel: enumColumn("channel").notNull(),

    enabled: boolean("enabled").notNull(),

    ...timestamps,
  },
  (t) => [
    // The triple IS the row, so "switched twice" cannot happen.
    primaryKey({ columns: [t.userId, t.template, t.channel] }),
    check(
      "notification_preferences_channel_check",
      sql`${t.channel} IN ('email', 'sms', 'in_app')`
    ),
  ]
)
