import { Inject, Injectable } from "@nestjs/common"
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { favorites, properties } from "../../db/schema"

@Injectable()
export class FavoritesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Somebody's saved list, newest first.
   *
   * Joined rather than fetched in two steps: the card needs the property, and
   * a list of ids followed by a second query is an N+1 waiting to be written
   * by whoever touches this next.
   */
  async list(input: { userId: string; limit: number; before?: string }) {
    const where = [eq(favorites.userId, input.userId)]
    // Keyset, not OFFSET (ARCHITECTURE §1) — the list is append-heavy at the
    // top, and OFFSET re-reads everything the guest already scrolled past.
    if (input.before) where.push(lt(favorites.createdAt, input.before))

    const rows = await this.db
      .select({ savedAt: favorites.createdAt, property: properties })
      .from(favorites)
      .innerJoin(properties, eq(properties.id, favorites.propertyId))
      .where(and(...where))
      .orderBy(desc(favorites.createdAt))
      .limit(input.limit + 1)

    const hasMore = rows.length > input.limit
    const page = hasMore ? rows.slice(0, input.limit) : rows
    return { rows: page, nextCursor: hasMore ? page[page.length - 1]!.savedAt : null }
  }

  /**
   * Saving.
   *
   * `ON CONFLICT DO NOTHING` against the composite key, so a double tap or two
   * devices at once cannot produce a duplicate or an error. `added` says
   * whether this call was the one that created the row — the count check needs
   * it, and a re-save must not push somebody over the limit.
   */
  async add(input: { userId: string; propertyId: string }): Promise<boolean> {
    const inserted = await this.db
      .insert(favorites)
      .values({ userId: input.userId, propertyId: input.propertyId })
      .onConflictDoNothing({ target: [favorites.userId, favorites.propertyId] })
      .returning({ propertyId: favorites.propertyId })
    return inserted.length > 0
  }

  /** Removing. Idempotent by nature: unsaving what was never saved is fine. */
  async remove(input: { userId: string; propertyId: string }): Promise<boolean> {
    const removed = await this.db
      .delete(favorites)
      .where(
        and(eq(favorites.userId, input.userId), eq(favorites.propertyId, input.propertyId))
      )
      .returning({ propertyId: favorites.propertyId })
    return removed.length > 0
  }

  async count(userId: string): Promise<number> {
    const [row] = await this.db
      .select({ n: sql<string>`COUNT(*)` })
      .from(favorites)
      .where(eq(favorites.userId, userId))
    // COUNT comes back as a string from node-postgres; every aggregate in this
    // codebase is cast at the boundary rather than compared as text.
    return Number(row?.n ?? 0)
  }

  /**
   * Which of these are already saved.
   *
   * For a search page that has to draw the heart filled or empty — one query
   * for the page, never one per card.
   */
  async savedAmong(input: { userId: string; propertyIds: string[] }): Promise<Set<string>> {
    if (input.propertyIds.length === 0) return new Set()
    const rows = await this.db
      .select({ propertyId: favorites.propertyId })
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, input.userId),
          inArray(favorites.propertyId, input.propertyIds)
        )
      )
    return new Set(rows.map((r) => r.propertyId))
  }
}
