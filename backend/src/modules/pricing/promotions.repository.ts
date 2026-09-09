import { Inject, Injectable } from "@nestjs/common"
import { and, desc, eq, inArray, isNull, lte, ne, or, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  promotionProperties,
  promotionRooms,
  promotions,
  properties,
  rooms,
} from "../../db/schema"

export type PromotionRow = typeof promotions.$inferSelect

@Injectable()
export class PromotionsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ------------------------------------------------------------ ownership */

  /**
   * Narrows a list of property ids down to the ones an org actually owns.
   *
   * The heart of this module's security. A promotion names the properties it
   * covers, and a caller who could name any id could put a 90% discount on a
   * competitor's hotel. The answer comes from the database, never from the
   * request (API1).
   *
   * Returns what IS owned; the caller compares counts and refuses the
   * difference, so the response never reveals which of the ids was real.
   */
  async ownedPropertyIds(input: {
    propertyIds: string[]
    orgId: string
    scoped: string[]
  }): Promise<string[]> {
    if (input.propertyIds.length === 0) return []

    const where = [
      inArray(properties.id, input.propertyIds),
      eq(properties.partnerOrgId, input.orgId),
    ]
    // Empty = every property the org owns.
    if (input.scoped.length > 0) where.push(inArray(properties.id, input.scoped))

    const rows = await this.db.select({ id: properties.id }).from(properties).where(and(...where))
    return rows.map((r) => r.id)
  }

  /** Rooms that actually sit inside the given properties. */
  async roomIdsWithin(roomIds: string[], propertyIds: string[]): Promise<string[]> {
    if (roomIds.length === 0 || propertyIds.length === 0) return []

    const rows = await this.db
      .select({ id: rooms.id })
      .from(rooms)
      .where(and(inArray(rooms.id, roomIds), inArray(rooms.propertyId, propertyIds)))
    return rows.map((r) => r.id)
  }

  /** A promotion, scoped to the org that owns it. Platform ones have no org. */
  async findForOrg(promotionId: string, orgId: string) {
    const [row] = await this.db
      .select()
      .from(promotions)
      .where(and(eq(promotions.id, promotionId), eq(promotions.partnerOrgId, orgId)))
      .limit(1)
    return row ?? null
  }

  async findById(promotionId: string) {
    const [row] = await this.db
      .select()
      .from(promotions)
      .where(eq(promotions.id, promotionId))
      .limit(1)
    return row ?? null
  }

  /* ----------------------------------------------------------------- read */

  async listForOrg(input: { orgId: string; status?: string; limit: number }) {
    const where = [eq(promotions.partnerOrgId, input.orgId)]
    if (input.status) where.push(eq(promotions.status, input.status))

    return this.db
      .select()
      .from(promotions)
      .where(and(...where))
      .orderBy(desc(promotions.startDate))
      .limit(input.limit)
  }

  /** Every promotion, for an admin — the platform's own included. */
  async listAll(input: { status?: string; limit: number }) {
    const where = input.status ? [eq(promotions.status, input.status)] : []
    return this.db
      .select()
      .from(promotions)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(promotions.startDate))
      .limit(input.limit)
  }

  /** The properties and rooms a promotion covers. */
  async scopeOf(promotionId: string) {
    const [propertyRows, roomRows] = await Promise.all([
      this.db
        .select({ id: promotionProperties.propertyId })
        .from(promotionProperties)
        .where(eq(promotionProperties.promotionId, promotionId)),
      this.db
        .select({ id: promotionRooms.roomId })
        .from(promotionRooms)
        .where(eq(promotionRooms.promotionId, promotionId)),
    ])
    return { propertyIds: propertyRows.map((r) => r.id), roomIds: roomRows.map((r) => r.id) }
  }

  /* ---------------------------------------------------------------- write */

  /**
   * Writes a promotion and everything it covers in ONE transaction.
   *
   * A promotion with no properties attached is not a smaller promotion, it is
   * a discount that reaches nobody — and one whose scope half-wrote would
   * reach some hotels and not others, with nothing to say which was intended.
   */
  async create(input: {
    row: typeof promotions.$inferInsert
    propertyIds: string[]
    roomIds: string[]
  }) {
    return this.db.transaction(async (tx) => {
      const [created] = await tx.insert(promotions).values(input.row).returning()

      await tx
        .insert(promotionProperties)
        .values(input.propertyIds.map((propertyId) => ({ promotionId: created!.id, propertyId })))

      if (input.roomIds.length > 0) {
        await tx
          .insert(promotionRooms)
          .values(input.roomIds.map((roomId) => ({ promotionId: created!.id, roomId })))
      }

      return created!
    })
  }

  /**
   * Updates a promotion, replacing its scope only when a new one was sent.
   *
   * `undefined` means "leave it alone" and an empty array means something
   * different for each: no properties is refused by the service, while no
   * rooms means "every room" (rule #21). Collapsing the two would silently
   * widen a promotion that was targeted at one suite.
   */
  async update(input: {
    promotionId: string
    patch: Partial<typeof promotions.$inferInsert>
    propertyIds?: string[]
    roomIds?: string[]
  }) {
    return this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(promotions)
        .set({ ...input.patch, updatedAt: new Date().toISOString() })
        .where(eq(promotions.id, input.promotionId))
        .returning()

      if (!updated) return null

      if (input.propertyIds !== undefined) {
        await tx
          .delete(promotionProperties)
          .where(eq(promotionProperties.promotionId, input.promotionId))
        await tx
          .insert(promotionProperties)
          .values(input.propertyIds.map((propertyId) => ({ promotionId: updated.id, propertyId })))
      }

      if (input.roomIds !== undefined) {
        await tx.delete(promotionRooms).where(eq(promotionRooms.promotionId, input.promotionId))
        if (input.roomIds.length > 0) {
          await tx
            .insert(promotionRooms)
            .values(input.roomIds.map((roomId) => ({ promotionId: updated.id, roomId })))
        }
      }

      return updated
    })
  }

  /* ------------------------------------------------------------ lifecycle */

  /**
   * Promotions whose status may no longer match the calendar.
   *
   * Only the two states a job may move — `draft` and `paused` are somebody's
   * decision and are never touched.
   */
  async dueForStatusChange(today: string, limit: number) {
    return this.db
      .select()
      .from(promotions)
      .where(
        and(
          inArray(promotions.status, ["scheduled", "active"]),
          or(lte(promotions.startDate, today), lte(promotions.endDate, today))
        )
      )
      .limit(limit)
  }

  /** Guarded on the current status, so two runs cannot both move one. */
  async advanceStatus(input: { promotionId: string; fromStatus: string; toStatus: string }) {
    const [row] = await this.db
      .update(promotions)
      .set({ status: input.toStatus, updatedAt: new Date().toISOString() })
      .where(
        and(eq(promotions.id, input.promotionId), eq(promotions.status, input.fromStatus))
      )
      .returning()
    return row ?? null
  }

  /** How many platform-wide promotions exist — admin reporting. */
  async platformCount() {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(promotions)
      .where(and(isNull(promotions.partnerOrgId), ne(promotions.status, "ended")))
    return Number(row?.count ?? 0)
  }
}
