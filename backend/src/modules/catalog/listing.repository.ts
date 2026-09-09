import { Inject, Injectable } from "@nestjs/common"
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  amenities,
  type NewProperty,
  partnerOrgs,
  photos,
  properties,
  propertyAmenities,
} from "../../db/schema"

export type PropertyRow = typeof properties.$inferSelect
export type PhotoRow = typeof photos.$inferSelect

/**
 * Creating listings, reviewing them, and their photos (rules #69–#74).
 *
 * Separate from `CatalogRepository`, which reads the published catalogue. The
 * two answer different questions — one serves guests, one serves the people
 * building and approving a listing — and a query written for one is almost
 * never right for the other.
 */
@Injectable()
export class ListingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ------------------------------------------------------------ property -- */

  /**
   * `NewProperty`, not the raw insert type: `base_price` is derived from the
   * rate plans and only `recomputeBasePrice` writes it (rule #138).
   */
  async createProperty(row: NewProperty) {
    const [created] = await this.db.insert(properties).values(row).returning()
    return created!
  }

  /**
   * A slug nobody else has.
   *
   * Derived from the name and then suffixed until it is free, rather than
   * letting the partner choose: a partner who picks their own slug is a
   * partner racing for `/hotels/hilton`.
   *
   * The loop is not the guard — a unique index is. Two properties created at
   * the same instant can both find `the-plaza` free; the second INSERT is what
   * fails, and the caller retries.
   */
  async freeSlug(base: string): Promise<string> {
    const taken = await this.db
      .select({ slug: properties.slug })
      .from(properties)
      .where(sql`${properties.slug} = ${base} OR ${properties.slug} LIKE ${base + "-%"}`)

    if (!taken.some((row) => row.slug === base)) return base

    const used = new Set(taken.map((row) => row.slug))
    for (let n = 2; n < 1000; n += 1) {
      const candidate = `${base}-${n}`
      if (!used.has(candidate)) return candidate
    }
    // A thousand hotels with one name is not a slug problem any more.
    return `${base}-${Date.now()}`
  }

  /** One property, scoped to the caller's org — somebody else's is not found. */
  async findOwned(input: { propertyId: string; orgId: string; propertyIds: string[] }) {
    const scoped =
      input.propertyIds.length > 0 ? [inArray(properties.id, input.propertyIds)] : []

    const [row] = await this.db
      .select()
      .from(properties)
      .where(
        and(
          eq(properties.id, input.propertyId),
          eq(properties.partnerOrgId, input.orgId),
          ...scoped
        )
      )
      .limit(1)
    return row ?? null
  }

  async updateProperty(propertyId: string, patch: Partial<typeof properties.$inferInsert>) {
    const [row] = await this.db
      .update(properties)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(properties.id, propertyId))
      .returning()
    return row ?? null
  }

  /**
   * What the publish check needs, counted rather than fetched.
   *
   * Only ACTIVE rate plans and only photos that are not rejected — a listing
   * whose five photos were all turned down has not met the bar, and counting
   * them would let it back into the queue unchanged.
   *
   * Written as raw SQL with explicit table aliases rather than through the
   * query builder. Drizzle renders a column reference inside a `sql` template
   * WITHOUT its table qualifier, so `JOIN rooms ON id = room_id` came out
   * ambiguous between the two tables and Postgres refused the whole statement.
   * Aliases spelled out here leave nothing to infer.
   *
   * `db.execute` returns snake_case keys whatever the TypeScript claims, so
   * the row type below says so and the mapping is by hand.
   */
  async completeness(propertyId: string) {
    const result = await this.db.execute<{
      rooms: number
      rate_plans: number
      photos: number
    }>(sql`
      SELECT
        (SELECT COUNT(*)::int FROM rooms r
          WHERE r.property_id = ${propertyId}::uuid AND r.status = 'active') AS rooms,
        (SELECT COUNT(*)::int FROM rate_plans rp
          JOIN rooms r2 ON r2.id = rp.room_id
          WHERE r2.property_id = ${propertyId}::uuid AND rp.status = 'active') AS rate_plans,
        (SELECT COUNT(*)::int FROM photos ph
          WHERE ph.property_id = ${propertyId}::uuid AND ph.status <> 'rejected') AS photos
    `)

    const row = result.rows[0]
    return {
      rooms: Number(row?.rooms ?? 0),
      ratePlans: Number(row?.rate_plans ?? 0),
      photos: Number(row?.photos ?? 0),
    }
  }

  /**
   * Everything the listing score is computed from, for a set of properties.
   *
   * One query for the whole page. The alternative — six counts per property —
   * makes the platform's content screen do 300 round trips to draw 50 rows.
   *
   * Reviews are counted from `published` only, the same rule everything else
   * derives a rating from (rule #40): a moderated review must not move a score
   * that the partner is being asked to act on.
   */
  async scoreInputs(propertyIds: readonly string[]) {
    if (propertyIds.length === 0) return []

    const ids = sql.join(
      propertyIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )

    const result = await this.db.execute<{
      property_id: string
      photos: number
      description_length: number
      rooms: number
      amenities: number
      value_adds: number
      review_count: number
      rating: string
      reviews_replied: number
    }>(sql`
      SELECT
        p.id AS property_id,
        (SELECT COUNT(*)::int FROM photos ph
          WHERE ph.property_id = p.id AND ph.status = 'approved') AS photos,
        length(p.description)::int AS description_length,
        (SELECT COUNT(*)::int FROM rooms r
          WHERE r.property_id = p.id AND r.status = 'active') AS rooms,
        (SELECT COUNT(*)::int FROM property_amenities pa
          WHERE pa.property_id = p.id) AS amenities,
        (SELECT COUNT(*)::int FROM value_adds va
          WHERE va.property_id = p.id AND va.active) AS value_adds,
        (SELECT COUNT(*)::int FROM reviews rv
          WHERE rv.property_id = p.id AND rv.status = 'published') AS review_count,
        (SELECT COALESCE(AVG(rv.rating), 0) FROM reviews rv
          WHERE rv.property_id = p.id AND rv.status = 'published') AS rating,
        (SELECT COUNT(*)::int FROM reviews rv
          WHERE rv.property_id = p.id AND rv.status = 'published'
            AND rv.response_text IS NOT NULL AND length(trim(rv.response_text)) > 0) AS reviews_replied
      FROM properties p
      WHERE p.id IN (${ids})
    `)

    return result.rows.map((row) => ({
      propertyId: row.property_id,
      photos: row.photos,
      descriptionLength: row.description_length,
      rooms: row.rooms,
      amenities: row.amenities,
      valueAdds: row.value_adds,
      reviewCount: row.review_count,
      // AVG comes back as a string from node-postgres.
      rating: Number(row.rating),
      reviewsReplied: row.reviews_replied,
    }))
  }

  /* -------------------------------------------------------------- review -- */

  /**
   * The platform's queue (rule #72).
   *
   * Two kinds of work, one list: listings waiting for their first approval,
   * and live listings with edits waiting. The second kind is invisible in
   * `status` on purpose — those listings are still `active`, still selling —
   * so `pending_changes IS NOT NULL` is the only thing that surfaces them.
   */
  async reviewQueue(input: { limit: number }) {
    return this.db
      .select()
      .from(properties)
      .where(
        or(eq(properties.status, "pending_review"), isNotNull(properties.pendingChanges))
      )
      .orderBy(asc(properties.updatedAt))
      .limit(input.limit)
  }

  /**
   * The platform's whole property list, filtered.
   *
   * One query with the owner joined and both counts as sub-selects. The
   * obvious alternative — list, then count rooms per row, then photos per row
   * — is an N+1 that turns a 50-row page into 101 round trips.
   *
   * Table names are written out because drizzle renders a column reference
   * inside a raw template WITHOUT its table qualifier, so `id = property_id`
   * comes out ambiguous across the join. Values are still bound.
   */
  async adminList(input: {
    q?: string
    status?: string
    orgId?: string
    needsReview?: boolean
    limit: number
    before?: string
  }) {
    /*
     * `%` and `_` are wildcards to ILIKE, so a guest name containing one would
     * quietly match far more than it should. Escaped with a backslash, which
     * is Postgres's default ESCAPE character.
     */
    const like = input.q ? `%${input.q.replace(/[%_\\]/g, (m) => "\\" + m)}%` : null

    const result = await this.db.execute<{
      id: string
      slug: string
      name: string
      city: string
      country: string
      type: string
      stars: number | null
      status: string
      org_id: string | null
      org_name: string | null
      base_price: number
      rooms: number
      photos: number
      has_pending: boolean
      created_at: string
      updated_at: string
    }>(sql`
      SELECT
        p.id, p.slug, p.name, p.city, p.country, p.type, p.stars, p.status,
        p.partner_org_id AS org_id,
        o.name           AS org_name,
        p.base_price     AS base_price,
        (SELECT COUNT(*)::int FROM rooms r WHERE r.property_id = p.id)    AS rooms,
        (SELECT COUNT(*)::int FROM photos ph WHERE ph.property_id = p.id) AS photos,
        (p.pending_changes IS NOT NULL) AS has_pending,
        p.created_at, p.updated_at
      FROM properties p
      LEFT JOIN partner_orgs o ON o.id = p.partner_org_id
      WHERE (${input.status ?? null}::text IS NULL OR p.status = ${input.status ?? null})
        AND (${input.orgId ?? null}::uuid IS NULL OR p.partner_org_id = ${input.orgId ?? null}::uuid)
        AND (
          ${like}::text IS NULL
          OR p.name ILIKE ${like} OR p.city ILIKE ${like} OR p.slug ILIKE ${like}
        )
        AND (
          ${input.needsReview ?? false} = FALSE
          -- Rule #72: both kinds of work in one queue - a first approval and
          -- an edit sitting on a listing that is already live.
          OR p.status = 'pending_review' OR p.pending_changes IS NOT NULL
        )
        AND (${input.before ?? null}::timestamptz IS NULL
             OR p.created_at < ${input.before ?? null}::timestamptz)
      ORDER BY p.created_at DESC
      LIMIT ${input.limit + 1}
    `)

    const rows = result.rows
    const hasMore = rows.length > input.limit
    const page = hasMore ? rows.slice(0, input.limit) : rows
    return { rows: page, nextCursor: hasMore ? page[page.length - 1]!.created_at : null }
  }

  /** How many listings sit in each state — the counters above the list. */
  async statusCounts() {
    const result = await this.db.execute<{ status: string; n: number }>(sql`
      SELECT status, COUNT(*)::int AS n FROM properties GROUP BY status
    `)
    return Object.fromEntries(result.rows.map((r) => [r.status, r.n]))
  }

  async findById(propertyId: string) {
    const [row] = await this.db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1)
    return row ?? null
  }

  /* -------------------------------------------------------------- photos -- */

  async addPhoto(row: typeof photos.$inferInsert) {
    const [created] = await this.db.insert(photos).values(row).returning()
    return created!
  }

  /**
   * The amenity SLUGS this property has.
   *
   * The extranet splits amenities across two screens by category, and a save
   * on either replaces the whole set — so both need to know the full list, not
   * just their own half, or saving on one silently clears the other.
   */
  /** Just the name — the caller already has the id and only wants a label. */
  async orgNameOf(orgId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ name: partnerOrgs.name })
      .from(partnerOrgs)
      .where(eq(partnerOrgs.id, orgId))
      .limit(1)
    return row?.name ?? null
  }

  async amenitySlugsFor(propertyId: string): Promise<string[]> {
    const rows = await this.db
      .select({ slug: amenities.slug })
      .from(propertyAmenities)
      .innerJoin(amenities, eq(amenities.id, propertyAmenities.amenityId))
      .where(eq(propertyAmenities.propertyId, propertyId))
      .orderBy(asc(amenities.position), asc(amenities.slug))
    return rows.map((row) => row.slug)
  }

  async photosFor(propertyId: string) {
    return this.db
      .select()
      .from(photos)
      .where(eq(photos.propertyId, propertyId))
      .orderBy(asc(photos.position), asc(photos.createdAt))
  }

  async countPhotos(propertyId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(photos)
      .where(and(eq(photos.propertyId, propertyId), sql`${photos.status} <> 'rejected'`))
    return Number(row?.count ?? 0)
  }

  /** A photo, scoped to a property the caller already proved they own. */
  async findPhoto(input: { photoId: string; propertyId: string }) {
    const [row] = await this.db
      .select()
      .from(photos)
      .where(and(eq(photos.id, input.photoId), eq(photos.propertyId, input.propertyId)))
      .limit(1)
    return row ?? null
  }

  async updatePhoto(photoId: string, patch: Partial<typeof photos.$inferInsert>) {
    const [row] = await this.db
      .update(photos)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(photos.id, photoId))
      .returning()
    return row ?? null
  }

  /**
   * A real DELETE, unlike almost everything else here.
   *
   * A photo is not a record of anything that happened — no booking references
   * it, no payout depends on it. Archiving it would leave a row whose only
   * purpose is to be filtered out of every query forever.
   */
  async deletePhoto(input: { photoId: string; propertyId: string }) {
    const [row] = await this.db
      .delete(photos)
      .where(and(eq(photos.id, input.photoId), eq(photos.propertyId, input.propertyId)))
      .returning()
    return row ?? null
  }

  /** Every pending photo approved at once, when a listing is signed off. */
  async approvePhotos(propertyId: string) {
    await this.db
      .update(photos)
      .set({ status: "approved", updatedAt: new Date().toISOString() })
      .where(and(eq(photos.propertyId, propertyId), eq(photos.status, "pending")))
  }

  /* ----------------------------------------------------------- amenities -- */

  async listAmenities() {
    return this.db.select().from(amenities).orderBy(asc(amenities.category), asc(amenities.label))
  }

  async upsertAmenity(row: typeof amenities.$inferInsert) {
    const [created] = await this.db
      .insert(amenities)
      .values(row)
      // The slug is the identity (rule #74), so re-adding one is an edit.
      .onConflictDoUpdate({
        target: amenities.slug,
        set: { label: row.label!, category: row.category!, icon: row.icon! },
      })
      .returning()
    return created!
  }

  async findAmenityBySlug(slug: string) {
    const [row] = await this.db.select().from(amenities).where(eq(amenities.slug, slug)).limit(1)
    return row ?? null
  }

  /** Newest first — the admin list, which is about what changed recently. */
  async recentProperties(limit: number) {
    return this.db.select().from(properties).orderBy(desc(properties.createdAt)).limit(limit)
  }
}
