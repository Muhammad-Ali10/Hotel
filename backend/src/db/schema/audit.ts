import { sql } from "drizzle-orm"
import { check, index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"

import { users } from "./auth"
import { enumColumn, primaryId } from "./_shared"

/* ============================================================================
 * Module 11 — the audit log (rules #77, #78).
 * ========================================================================== */

/**
 * What an administrator did, and why.
 *
 * Written for every action that changes **money, access or status** — a
 * refund, a forced transition, a role change, a suspension, a listing verdict,
 * a commission rate. Not for reads: an audit log that records every page view
 * is one nobody can find anything in.
 *
 * **Append-only.** There is no `updated_at` because nothing updates a row, and
 * a database rule below refuses UPDATE and DELETE outright. An audit log that
 * can be edited is not an audit log — it is a note.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: primaryId(),

    /**
     * Who. `set null` rather than cascade: an administrator leaving must not
     * erase what they did, and the snapshot below keeps the row readable.
     */
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    /**
     * Their email AT THE TIME, snapshotted.
     *
     * A join would give the current one, and a name that changed after the
     * fact makes a log harder to trust rather than easier. This is what the
     * record has to survive on when the account is gone.
     */
    actorEmail: varchar("actor_email", { length: 254 }).notNull(),

    /** What, as a stable machine key: `booking.refund`, `user.suspend`. */
    action: varchar("action", { length: 64 }).notNull(),

    /** What it was done TO. */
    subjectType: enumColumn("subject_type").notNull(),
    subjectId: uuid("subject_id"),

    /**
     * Why (rule #78).
     *
     * Required for anything irreversible, enforced in the service rather than
     * here — a listing approval needs no reason, a refund does, and a CHECK
     * cannot tell them apart without hard-coding the list of actions into the
     * schema.
     */
    reason: text("reason").notNull().default(""),

    /**
     * The figures, for the actions that move money.
     *
     * JSONB rather than columns because a refund, a role change and a
     * commission update have nothing in common to normalise. Nothing queries
     * inside it; it is there so a human reading the row can see what happened
     * without opening three other tables.
     */
    metadata: jsonb("metadata"),

    /**
     * Where from.
     *
     * Deliberately different from rule #68, which keeps IP addresses out of
     * SEARCH events. That rule protects guests from being profiled for
     * analytics. This is the opposite situation: a privileged action on
     * somebody else's money, and "which machine" is exactly what an incident
     * review needs. Staff accountability, not guest surveillance.
     */
    ip: varchar("ip", { length: 45 }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // "What happened to this booking / user / property" — the common read.
    index("audit_log_subject_idx").on(t.subjectType, t.subjectId, t.createdAt),
    // "What did this administrator do" — the other one.
    index("audit_log_actor_idx").on(t.actorId, t.createdAt),
    index("audit_log_created_idx").on(t.createdAt),
    check(
      "audit_log_subject_type_check",
      sql`${t.subjectType} IN (
        'booking', 'user', 'property', 'partner_org', 'payout', 'review',
        'promotion', 'partner_contract', 'contract_template', 'partner_registration',
        -- An announcement sent to customers. Not any of the others: it is
        -- about no single row, which is exactly why it needs recording.
        'notification'
      )`
    ),
    check("audit_log_action_check", sql`length(${t.action}) > 0`),
  ]
)
