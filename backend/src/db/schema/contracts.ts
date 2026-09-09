import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

import { partnerOrgs, users } from "./auth"
import { enumColumn, primaryId, timestamps } from "./_shared"

/* ============================================================================
 * Module 15 — the agreements a partner signs (rule #98).
 *
 * Two tables, and the split is the whole point:
 *
 *   contract_templates   what the PLATFORM offers, versioned
 *   partner_contracts    what ONE partner accepted, and when
 *
 * One table would mean a copy of the same agreement text for every partner,
 * and no way to answer "who is still on version 1" — which is the first
 * question legal asks when a term changes.
 * ========================================================================== */

export const CONTRACT_KINDS = ["service", "commission", "addendum", "policy"] as const
export const CONTRACT_STATUSES = ["accepted", "superseded", "terminated"] as const

/**
 * The platform's side: one version of one agreement.
 *
 * `version` is an integer per `kind`, not a date or a semver string: the only
 * question anybody asks is "is this newer than what they signed", and integers
 * answer it without a parser.
 */
export const contractTemplates = pgTable(
  "contract_templates",
  {
    id: primaryId(),
    kind: enumColumn("kind").notNull(),
    version: integer("version").notNull(),

    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),

    /**
     * Whether new partners are asked to accept this one.
     *
     * A superseded version stays in the table forever — partners signed it,
     * and their acceptance points at a row that has to still be there.
     */
    active: boolean("active").notNull().default(true),
    effectiveFrom: date("effective_from").notNull(),

    ...timestamps,
  },
  (t) => [
    unique("contract_templates_kind_version_unique").on(t.kind, t.version),
    index("contract_templates_active_idx").on(t.kind, t.active),
    check(
      "contract_templates_kind_check",
      sql`${t.kind} IN ('service', 'commission', 'addendum', 'policy')`
    ),
    check("contract_templates_version_check", sql`${t.version} >= 1`),
    check("contract_templates_body_check", sql`length(trim(${t.body})) > 0`),
  ]
)

/**
 * A partner's acceptance (rule #98).
 *
 * The agreement text is COPIED here rather than only referenced. A signature
 * is a record of a moment: if somebody edits a template row afterwards, what
 * this partner agreed to must not change underneath them. The same reasoning
 * that puts `property_name` on a booking.
 *
 * **The signature itself cannot be edited** — a database trigger refuses any
 * UPDATE that touches the org, the version, the text, who accepted or when
 * (migration 0025). Only the lifecycle columns move: an agreement can be
 * superseded or terminated, and that is recorded here rather than by rewriting
 * what somebody signed.
 *
 * `status` has no `pending`. An acceptance that has not happened is not a row
 * with a flag on it — it is the absence of a row.
 */
export const partnerContracts = pgTable(
  "partner_contracts",
  {
    id: primaryId(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => partnerOrgs.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => contractTemplates.id, { onDelete: "restrict" }),

    /** Snapshots, so the record stands on its own. */
    kind: enumColumn("kind").notNull(),
    version: integer("version").notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),

    status: enumColumn("status").notNull().default("accepted"),

    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    /**
     * `set null` on the user, and the name is kept separately.
     *
     * A person can leave; who signed cannot become unknown because their
     * account was closed.
     */
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    acceptedByName: varchar("accepted_by_name", { length: 160 }).notNull(),
    acceptedIp: varchar("accepted_ip", { length: 64 }),

    expiresAt: date("expires_at"),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "string" }),
    endedReason: text("ended_reason"),

    ...timestamps,
  },
  (t) => [
    /*
     * One acceptance per version, per organisation.
     *
     * A second click on "I agree" must not produce a second signature, and a
     * retry after a dropped response must land on the same row.
     */
    unique("partner_contracts_org_template_unique").on(t.orgId, t.templateId),
    index("partner_contracts_org_idx").on(t.orgId, t.acceptedAt),
    check(
      "partner_contracts_kind_check",
      sql`${t.kind} IN ('service', 'commission', 'addendum', 'policy')`
    ),
    check(
      "partner_contracts_status_check",
      sql`${t.status} IN ('accepted', 'superseded', 'terminated')`
    ),
    /* An ended agreement carries when and why; a live one carries neither. */
    check(
      "partner_contracts_ended_check",
      sql`(${t.status} = 'accepted') = (${t.endedAt} IS NULL)`
    ),
  ]
)
