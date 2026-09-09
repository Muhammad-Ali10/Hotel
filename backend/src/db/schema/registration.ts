import { sql } from "drizzle-orm"
import {
  check,
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

import { partnerOrgs, users } from "./auth"
import { properties } from "./catalog"
import { enumColumn, primaryId, timestamps } from "./_shared"

/* ============================================================================
 * Module 12 — the registration wizard (rule #103).
 *
 * ONE row per person, holding a draft document and where they got to.
 *
 * The alternative — writing real `partner_orgs` / `properties` / `rooms` rows
 * as the partner types — was considered and rejected for two reasons:
 *
 *  1. The wizard's ORDER does not match the tables' constraints. Step 5 picks
 *     a property type; the name arrives at step 6, the rooms at 14–19. Writing
 *     incrementally means making every column nullable, which is exactly what
 *     this schema refuses to do everywhere else.
 *
 *  2. Most registrations are abandoned. Real rows would fill `partner_orgs`
 *     and `properties` with shells that every admin screen then has to filter
 *     out, forever.
 *
 * So the draft is a document, and `submit` is the transaction that turns it
 * into rows. The document is not a free-for-all: a zod schema in `shared`
 * validates every write, so it cannot quietly become a fifth type system.
 * ========================================================================== */

export const REGISTRATION_STATUSES = ["in_progress", "submitted", "approved", "rejected"] as const

export const partnerRegistrations = pgTable(
  "partner_registrations",
  {
    id: primaryId(),

    /**
     * Whose registration this is.
     *
     * Steps 1–4 are the account itself, and they are just signup and email
     * verification — endpoints that already exist. A registration row starts
     * at step 5, when there is somebody to attach it to.
     */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    status: enumColumn("status").notNull().default("in_progress"),

    /** The furthest step reached, so "continue where you left off" is real. */
    currentStep: smallint("current_step").notNull().default(5),

    /** The whole draft, validated by `registrationDraftSchema` on every write. */
    data: jsonb("data").notNull().default({}),

    submittedAt: timestamp("submitted_at", { withTimezone: true, mode: "string" }),
    decidedAt: timestamp("decided_at", { withTimezone: true, mode: "string" }),
    decisionNote: text("decision_note"),

    /**
     * What the draft became. Both NULL until submit succeeds.
     *
     * `restrict` rather than `cascade`: once a registration has produced a real
     * organisation, deleting that organisation should not silently take the
     * record of how it came to exist with it.
     */
    orgId: uuid("org_id").references(() => partnerOrgs.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "restrict" }),

    ...timestamps,
  },
  (t) => [
    /*
     * One live registration per person.
     *
     * Somebody listing a second property does it from the extranet, which has
     * every endpoint for it. A second wizard run would produce a second
     * organisation for the same person, which is never what they meant.
     */
    unique("partner_registrations_user_unique").on(t.userId),
    index("partner_registrations_status_idx").on(t.status, t.submittedAt),
    check(
      "partner_registrations_status_check",
      sql`${t.status} IN ('in_progress', 'submitted', 'approved', 'rejected')`
    ),
    check(
      "partner_registrations_step_check",
      sql`${t.currentStep} >= 1 AND ${t.currentStep} <= 31`
    ),
    /* Submitted means submitted: the timestamp and the status move together. */
    check(
      "partner_registrations_submitted_check",
      sql`(${t.status} = 'in_progress') = (${t.submittedAt} IS NULL)`
    ),
    /* A decision has a date, and a date means a decision. */
    check(
      "partner_registrations_decided_check",
      sql`(${t.status} IN ('approved', 'rejected')) = (${t.decidedAt} IS NOT NULL)`
    ),
    /* Approving is what creates the rows, so approval cannot exist without them. */
    check(
      "partner_registrations_result_check",
      sql`${t.status} <> 'approved' OR (${t.orgId} IS NOT NULL AND ${t.propertyId} IS NOT NULL)`
    ),
  ]
)

/* ============================================================================
 * Verification documents (step 29).
 * ========================================================================== */

export const DOCUMENT_KINDS = ["identity", "ownership", "business", "tax", "other"] as const
export const DOCUMENT_STATUSES = ["pending", "approved", "rejected"] as const

/**
 * A file a partner uploaded to prove who they are.
 *
 * Attached to the REGISTRATION rather than to the organisation, because it is
 * needed before the organisation exists. It survives approval — "what did we
 * check, and who checked it" has to keep having an answer.
 *
 * Bytes never pass through the API: the same presigned upload the listing
 * photos use (rule #73), and only the key is stored.
 */
export const registrationDocuments = pgTable(
  "registration_documents",
  {
    id: primaryId(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => partnerRegistrations.id, { onDelete: "cascade" }),

    kind: enumColumn("kind").notNull(),
    status: enumColumn("status").notNull().default("pending"),

    fileName: varchar("file_name", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),

    reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "string" }),
    reviewNote: text("review_note"),

    ...timestamps,
  },
  (t) => [
    index("registration_documents_registration_idx").on(t.registrationId, t.kind),
    unique("registration_documents_key_unique").on(t.storageKey),
    check(
      "registration_documents_kind_check",
      /*
       * `photo` is a listing photograph, not a verification document — it is
       * carried here because it is the same upload: presign, PUT, confirm, with
       * the key checked against this registration's own prefix.
       *
       * The alternative was a second uploader writing into `photos`, which
       * needs a `property_id`, which does not exist until approval. Approval
       * copies these rows across (rule #103) and the property goes live with
       * the pictures the applicant chose — rather than with none, which is what
       * it did before.
       */
      sql`${t.kind} IN ('identity', 'ownership', 'business', 'tax', 'other', 'photo')`
    ),
    check(
      "registration_documents_status_check",
      sql`${t.status} IN ('pending', 'approved', 'rejected')`
    ),
    /* A reviewed document carries when; an unreviewed one carries neither. */
    check(
      "registration_documents_reviewed_check",
      sql`(${t.status} = 'pending') = (${t.reviewedAt} IS NULL)`
    ),
  ]
)
