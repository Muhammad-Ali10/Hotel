import { Inject, Injectable } from "@nestjs/common"
import { and, asc, desc, eq, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { contractTemplates, partnerContracts } from "../../db/schema"

export type TemplateRow = typeof contractTemplates.$inferSelect
export type ContractRow = typeof partnerContracts.$inferSelect

@Injectable()
export class ContractsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ------------------------------------------------------------ templates */

  async createTemplate(row: typeof contractTemplates.$inferInsert) {
    const [created] = await this.db.insert(contractTemplates).values(row).returning()
    return created!
  }

  /**
   * The next version number for a kind.
   *
   * `MAX(version) + 1` inside the same transaction as the insert, with the
   * UNIQUE on `(kind, version)` behind it. Two people publishing at once both
   * read the same maximum; the constraint is what stops the second one, and
   * the caller retries rather than silently overwriting a version.
   */
  async nextVersion(kind: string): Promise<number> {
    const [row] = await this.db
      .select({ v: sql<number>`COALESCE(MAX(${contractTemplates.version}), 0)::int` })
      .from(contractTemplates)
      .where(eq(contractTemplates.kind, kind))
    return (row?.v ?? 0) + 1
  }

  findTemplate(id: string) {
    return this.db
      .select()
      .from(contractTemplates)
      .where(eq(contractTemplates.id, id))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  }

  listTemplates(input: { kind?: string; activeOnly?: boolean }) {
    const where = []
    if (input.kind) where.push(eq(contractTemplates.kind, input.kind))
    if (input.activeOnly) where.push(eq(contractTemplates.active, true))

    return this.db
      .select()
      .from(contractTemplates)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(asc(contractTemplates.kind), desc(contractTemplates.version))
  }

  async deactivateTemplate(id: string) {
    await this.db
      .update(contractTemplates)
      .set({ active: false })
      .where(eq(contractTemplates.id, id))
  }

  /* ------------------------------------------------------------ signatures */

  /**
   * Accepting, once.
   *
   * `ON CONFLICT DO NOTHING` against `(org_id, template_id)`: a second click,
   * or a retry after a dropped response, must land on the row that already
   * exists rather than producing a second signature. The returning row is
   * empty on a conflict, so the caller reads the existing one back.
   */
  async accept(row: typeof partnerContracts.$inferInsert) {
    const [created] = await this.db
      .insert(partnerContracts)
      .values(row)
      .onConflictDoNothing({
        target: [partnerContracts.orgId, partnerContracts.templateId],
      })
      .returning()
    return created ?? null
  }

  findAcceptance(input: { orgId: string; templateId: string }) {
    return this.db
      .select()
      .from(partnerContracts)
      .where(
        and(
          eq(partnerContracts.orgId, input.orgId),
          eq(partnerContracts.templateId, input.templateId)
        )
      )
      .limit(1)
      .then((rows) => rows[0] ?? null)
  }

  findContract(input: { id: string; orgId?: string }) {
    const where = [eq(partnerContracts.id, input.id)]
    if (input.orgId) where.push(eq(partnerContracts.orgId, input.orgId))

    return this.db
      .select()
      .from(partnerContracts)
      .where(and(...where))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  }

  listForOrg(orgId: string) {
    return this.db
      .select()
      .from(partnerContracts)
      .where(eq(partnerContracts.orgId, orgId))
      .orderBy(desc(partnerContracts.acceptedAt))
  }

  /**
   * Only the lifecycle moves.
   *
   * The signature columns are refused by a database trigger, not by the shape
   * of this method — so a query written somewhere else, or run by hand, hits
   * the same wall.
   */
  async endContract(input: { id: string; status: "superseded" | "terminated"; reason: string }) {
    const [updated] = await this.db
      .update(partnerContracts)
      .set({
        status: input.status,
        endedAt: new Date().toISOString(),
        endedReason: input.reason,
      })
      .where(eq(partnerContracts.id, input.id))
      .returning()
    return updated ?? null
  }

  /** Live acceptances of one kind, across every organisation. */
  liveOfKind(kind: string) {
    return this.db
      .select()
      .from(partnerContracts)
      .where(and(eq(partnerContracts.kind, kind), eq(partnerContracts.status, "accepted")))
  }
}
