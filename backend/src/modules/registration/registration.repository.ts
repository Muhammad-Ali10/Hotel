import { Inject, Injectable } from "@nestjs/common"
import { and, asc, desc, eq, ne, sql } from "drizzle-orm"
import { DEFAULT_COMMISSION_BPS } from "@stayora/shared"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  partnerRegistrations,
  platformSettings,
  registrationDocuments,
  users,
} from "../../db/schema"

export type RegistrationRow = typeof partnerRegistrations.$inferSelect
export type DocumentRow = typeof registrationDocuments.$inferSelect

@Injectable()
export class RegistrationRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ------------------------------------------------------------ the draft */

  findForUser(userId: string) {
    return this.db
      .select()
      .from(partnerRegistrations)
      .where(eq(partnerRegistrations.userId, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  }

  findById(id: string) {
    return this.db
      .select()
      .from(partnerRegistrations)
      .where(eq(partnerRegistrations.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  }

  /**
   * The row for this person, creating it if this is their first screen.
   *
   * `ON CONFLICT DO NOTHING` against the unique on `user_id`: two tabs open on
   * step 5 both try to create one, and the second must join the first rather
   * than fail or produce a duplicate.
   */
  async ensureFor(userId: string): Promise<RegistrationRow> {
    const [created] = await this.db
      .insert(partnerRegistrations)
      .values({ userId, data: {} })
      .onConflictDoNothing({ target: partnerRegistrations.userId })
      .returning()

    return created ?? (await this.findForUser(userId))!
  }

  /**
   * Merges a screen's answers into the draft.
   *
   * `data || ${patch}` is a Postgres jsonb merge, done in the DATABASE rather
   * than read-modify-write in JavaScript. Two screens saved at once would
   * otherwise each write the whole document from their own stale copy, and the
   * later one would silently erase the earlier one's answers.
   *
   * `currentStep` only ever moves FORWARD (`GREATEST`). Going back to review
   * an earlier screen must not throw away how far they actually got.
   */
  async patch(input: { id: string; patch: Record<string, unknown>; step?: number }) {
    const [row] = await this.db
      .update(partnerRegistrations)
      .set({
        data: sql`${partnerRegistrations.data} || ${JSON.stringify(input.patch)}::jsonb`,
        ...(input.step !== undefined
          ? { currentStep: sql`GREATEST(${partnerRegistrations.currentStep}, ${input.step})` }
          : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(partnerRegistrations.id, input.id))
      .returning()
    return row ?? null
  }

  async update(id: string, patch: Partial<typeof partnerRegistrations.$inferInsert>) {
    const [row] = await this.db
      .update(partnerRegistrations)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(partnerRegistrations.id, id))
      .returning()
    return row ?? null
  }

  /* -------------------------------------------------------------- the list */

  /**
   * The platform's queue, with the applicant joined.
   *
   * Table names spelled out: drizzle renders a column reference inside a raw
   * template without its table qualifier, so `id = user_id` comes out
   * ambiguous across the join.
   */
  async list(input: { status?: string; q?: string; limit: number; before?: string }) {
    const like = input.q ? `%${input.q.replace(/[%_\\]/g, (m) => "\\" + m)}%` : null

    const result = await this.db.execute<{
      id: string
      status: string
      current_step: number
      data: Record<string, unknown>
      applicant_name: string
      applicant_email: string
      documents: number
      submitted_at: string | null
      created_at: string
    }>(sql`
      SELECT
        r.id, r.status, r.current_step, r.data,
        trim(u.first_name || ' ' || u.last_name) AS applicant_name,
        u.email AS applicant_email,
        (SELECT COUNT(*)::int FROM registration_documents d
          WHERE d.registration_id = r.id) AS documents,
        r.submitted_at, r.created_at
      FROM partner_registrations r
      JOIN users u ON u.id = r.user_id
      WHERE (${input.status ?? null}::text IS NULL OR r.status = ${input.status ?? null})
        AND (
          ${like}::text IS NULL
          OR u.email ILIKE ${like}
          OR (u.first_name || ' ' || u.last_name) ILIKE ${like}
          OR (r.data ->> 'propertyName') ILIKE ${like}
        )
        AND (${input.before ?? null}::timestamptz IS NULL
             OR r.created_at < ${input.before ?? null}::timestamptz)
      ORDER BY r.created_at DESC
      LIMIT ${input.limit + 1}
    `)

    const rows = result.rows
    const hasMore = rows.length > input.limit
    const page = hasMore ? rows.slice(0, input.limit) : rows
    return { rows: page, nextCursor: hasMore ? page[page.length - 1]!.created_at : null }
  }

  /* ------------------------------------------------------------- documents */

  async addDocument(row: typeof registrationDocuments.$inferInsert) {
    const [created] = await this.db.insert(registrationDocuments).values(row).returning()
    return created!
  }

  /**
   * Whether the applicant has proved their email address.
   *
   * A partner agreement, a payout account and the approval decision itself all
   * hang off this address. An application submitted from an address nobody has
   * confirmed is one the platform cannot tell the outcome of — an approved
   * partner would never learn they were approved.
   */
  async emailVerified(userId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ verifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return Boolean(row?.verifiedAt)
  }

  /**
   * The rate a new organisation is created with (rule #106).
   *
   * Read here rather than restated in the wizard's copy, so the figure an
   * applicant is shown is the figure their first invoice uses. The settings
   * row is a singleton — a `CHECK (id = 1)` guarantees it.
   */
  async defaultCommissionRateBps(): Promise<number> {
    const [row] = await this.db
      .select({ bps: platformSettings.defaultCommissionRateBps })
      .from(platformSettings)
      .limit(1)

    /*
     * The settings row is created on demand — by the admin settings screen,
     * the first time anybody opens it. On an installation where nobody has,
     * there is no row, and the fallback here used to be ZERO.
     *
     * Zero is not a safe default for a commercial term. The wizard quotes this
     * figure to the applicant twice: as "Platform commission (0.00%)" beside
     * their room price, and as what is deducted before their payout. A partner
     * would sign up having been shown, in writing, that the platform takes
     * nothing — and find 15% on their first invoice.
     *
     * The plan default is what a new organisation is actually created on, so
     * it is what an unconfigured platform should quote.
     */
    return row?.bps ?? DEFAULT_COMMISSION_BPS.professional
  }

  documentsFor(registrationId: string) {
    return this.db
      .select()
      .from(registrationDocuments)
      .where(eq(registrationDocuments.registrationId, registrationId))
      .orderBy(asc(registrationDocuments.kind), desc(registrationDocuments.createdAt))
  }

  findDocument(input: { documentId: string; registrationId?: string }) {
    const where = [eq(registrationDocuments.id, input.documentId)]
    if (input.registrationId) {
      where.push(eq(registrationDocuments.registrationId, input.registrationId))
    }
    return this.db
      .select()
      .from(registrationDocuments)
      .where(and(...where))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  }

  async reviewDocument(input: {
    documentId: string
    status: "approved" | "rejected"
    note: string
  }) {
    const [row] = await this.db
      .update(registrationDocuments)
      .set({
        status: input.status,
        reviewedAt: new Date().toISOString(),
        reviewNote: input.note,
      })
      .where(eq(registrationDocuments.id, input.documentId))
      .returning()
    return row ?? null
  }

  /**
   * How many uploads of one sort this registration has.
   *
   * `scope` rather than a raw kind, because the two sorts are counted against
   * separate allowances: "photo" is the listing gallery, "document" is
   * everything else. Passing a single kind would make the document count
   * exclude the other four.
   */
  async countDocuments(
    registrationId: string,
    scope: "all" | "photo" | "document" = "all"
  ): Promise<number> {
    const filters = [eq(registrationDocuments.registrationId, registrationId)]
    if (scope === "photo") filters.push(eq(registrationDocuments.kind, "photo"))
    if (scope === "document") filters.push(ne(registrationDocuments.kind, "photo"))

    const [row] = await this.db
      .select({ n: sql<string>`COUNT(*)` })
      .from(registrationDocuments)
      .where(and(...filters))
    return Number(row?.n ?? 0)
  }
}
