import { Inject, Injectable, Logger } from "@nestjs/common"
import { and, desc, eq, lt, type SQL } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { auditLog } from "../../db/schema"
import type { AuthenticatedUser } from "../auth/auth.service"

/** The things an audit line can be about. Matches the table's CHECK. */
export type AuditSubject =
  | "booking"
  | "user"
  | "property"
  | "partner_org"
  | "payout"
  | "review"
  | "promotion"
  | "partner_contract"
  | "contract_template"
  | "partner_registration"
  /** An announcement to customers — about no single row, which is the point. */
  | "notification"

export type AuditEntry = {
  actor: AuthenticatedUser
  action: string
  subjectType: AuditSubject
  subjectId?: string | null
  reason?: string
  metadata?: Record<string, unknown>
  ip?: string | null
}

/**
 * Writing down what an administrator did (rules #77, #78).
 *
 * One service, injected everywhere an admin can change money, access or
 * status. Central on purpose: an audit trail assembled from eight modules each
 * writing their own rows is one where the eighth quietly stops.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Records an action.
   *
   * Takes an optional transaction so the line can be written in the SAME
   * transaction as the thing it describes — the principle rule #57 already
   * established for notifications. A refund that commits without its audit
   * line is a refund nobody can explain.
   *
   * Failures are NOT swallowed. That is the opposite of the notification
   * outbox, and deliberately: a message that does not send is an inconvenience,
   * while an action that happens without a record is the exact thing this
   * table exists to make impossible. If it cannot be written, the action
   * should not stand.
   */
  async record(entry: AuditEntry, tx?: Database): Promise<void> {
    const db = tx ?? this.db
    await db.insert(auditLog).values({
      actorId: entry.actor.id,
      // Snapshotted: this is what the row survives on when the account is gone.
      actorEmail: entry.actor.email,
      action: entry.action,
      subjectType: entry.subjectType,
      subjectId: entry.subjectId ?? null,
      reason: entry.reason ?? "",
      metadata: entry.metadata ?? null,
      ip: entry.ip ?? null,
    })
  }

  /**
   * The log, newest first.
   *
   * Keyset pagination on `created_at`, not an offset: an append-only table
   * grows at the head, and `OFFSET 5000` on a log that gained rows since the
   * last page silently repeats and skips entries.
   */
  async list(input: {
    limit: number
    before?: string
    subjectType?: AuditSubject
    subjectId?: string
    actorId?: string
  }) {
    const where: SQL[] = []
    if (input.before) where.push(lt(auditLog.createdAt, input.before))
    if (input.subjectType) where.push(eq(auditLog.subjectType, input.subjectType))
    if (input.subjectId) where.push(eq(auditLog.subjectId, input.subjectId))
    if (input.actorId) where.push(eq(auditLog.actorId, input.actorId))

    const rows = await this.db
      .select()
      .from(auditLog)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(input.limit + 1)

    const hasMore = rows.length > input.limit
    const page = hasMore ? rows.slice(0, input.limit) : rows

    return {
      items: page,
      nextCursor: hasMore ? (page[page.length - 1]?.createdAt ?? null) : null,
    }
  }
}
