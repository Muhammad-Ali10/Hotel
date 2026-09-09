import { Inject, Injectable } from "@nestjs/common"
import type { ReviewCategories } from "@stayora/shared"
import { REVIEW_CATEGORIES, type RatingTotals } from "@stayora/shared"
import { and, desc, eq, gte, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { bookings, partnerMembers, properties, reviews, users } from "../../db/schema"

export type ReviewRow = typeof reviews.$inferSelect

@Injectable()
export class ReviewsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ----------------------------------------------------------------- write */

  async create(row: {
    propertyId: string
    bookingId: string
    authorId: string
    author: string
    authorSeed: string
    country: string
    roomName: string
    rating: number
    categories: ReviewCategories
    title: string
    body: string
    date: string
  }) {
    // The unique index settles the race the eligibility check cannot: two
    // submissions can both read "not reviewed yet" and both arrive here. The
    // loser gets no row back rather than a raw constraint error, which would
    // otherwise surface as a 500.
    const [created] = await this.db
      .insert(reviews)
      .values(row)
      .onConflictDoNothing({ target: reviews.bookingId })
      .returning()
    return created ?? null
  }

  /**
   * The booking a review is being written against, scoped to its author.
   *
   * The ownership filter is in the query (API1): somebody else's stay is not
   * something to review, and it does not exist here.
   */
  async findOwnedBooking(input: { bookingId: string; userId: string }) {
    const [row] = await this.db
      .select({
        id: bookings.id,
        propertyId: bookings.propertyId,
        roomName: bookings.roomName,
        status: bookings.status,
        checkOut: bookings.checkOut,
        guestCountry: bookings.guestCountry,
      })
      .from(bookings)
      .where(and(eq(bookings.id, input.bookingId), eq(bookings.customerId, input.userId)))
      .limit(1)
    return row ?? null
  }

  /**
   * The stays a guest may still write about (rule #39).
   *
   * `completed`, inside the window, and not already reviewed — the same three
   * conditions `canReview` enforces, applied as a query so the dashboard does
   * not have to fetch every booking and sieve them client-side.
   */
  async reviewableBookings(input: { userId: string; notBefore: string; limit: number }) {
    return this.db
      .select({
        id: bookings.id,
        ref: bookings.ref,
        propertyId: bookings.propertyId,
        propertyName: bookings.propertyName,
        roomName: bookings.roomName,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
      })
      .from(bookings)
      .leftJoin(reviews, eq(reviews.bookingId, bookings.id))
      .where(
        and(
          eq(bookings.customerId, input.userId),
          eq(bookings.status, "completed"),
          gte(bookings.checkOut, input.notBefore),
          isNull(reviews.id)
        )
      )
      .orderBy(desc(bookings.checkOut))
      .limit(input.limit)
  }

  /** Everything one guest has written, whatever its moderation state. */
  async listByAuthor(input: { userId: string; limit: number; cursor?: string }) {
    return this.page({
      where: [eq(reviews.authorId, input.userId)],
      limit: input.limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    })
  }

  /**
   * Property names for a set of ids, in ONE query.
   *
   * A guest's own review list has to say WHICH hotel it is about. The review
   * row carries only `property_id` — deliberately, because a review is about
   * the property and not about the name it had that week — so the name is
   * joined at read time and is always current.
   */
  async propertyNamesFor(propertyIds: readonly string[]): Promise<Map<string, string>> {
    if (propertyIds.length === 0) return new Map()
    const rows = await this.db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(inArray(properties.id, [...propertyIds]))
    return new Map(rows.map((row) => [row.id, row.name]))
  }

  /** Tab counts for the partner and admin queues, in one grouped query. */
  async countsForProperties(propertyIds: string[]): Promise<Record<string, number>> {
    if (propertyIds.length === 0) return {}
    const rows = await this.db
      .select({ status: reviews.status, count: sql<number>`COUNT(*)::int` })
      .from(reviews)
      .where(inArray(reviews.propertyId, propertyIds))
      .groupBy(reviews.status)

    return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]))
  }

  /**
   * The same counts, across the whole platform.
   *
   * `countsForProperties` answers for one partner's portfolio; the moderation
   * queue is not scoped to anybody, so it needs the unscoped figure. Two
   * methods rather than an optional argument, because "no properties" and
   * "every property" are opposite answers and one function returning both
   * depending on an empty array is exactly how that goes wrong.
   */
  async countsForModeration(): Promise<Record<string, number>> {
    const rows = await this.db
      .select({ status: reviews.status, count: sql<number>`COUNT(*)::int` })
      .from(reviews)
      .groupBy(reviews.status)

    return Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]))
  }

  async existsForBooking(bookingId: string) {
    const [row] = await this.db
      .select({ id: reviews.id })
      .from(reviews)
      .where(eq(reviews.bookingId, bookingId))
      .limit(1)
    return row !== undefined
  }

  /* ------------------------------------------------------------------ read */

  async findById(id: string) {
    const [row] = await this.db.select().from(reviews).where(eq(reviews.id, id)).limit(1)
    return row ?? null
  }

  /** Public listing — `published` only, and that is not a parameter. */
  async listPublished(input: { propertyId: string; limit: number; cursor?: string }) {
    return this.page({
      where: [eq(reviews.propertyId, input.propertyId), eq(reviews.status, "published")],
      limit: input.limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    })
  }

  /**
   * Rating totals, one row per property, computed by the database.
   *
   * The obvious version — fetch every review and average in Node — turns a
   * 20-result search page into "ship every review of twenty properties", which
   * is unbounded work per request (API4). This ships one row each.
   *
   * Sums, not averages: `ratingFromTotals` owns the arithmetic, and integer
   * sums are exact in both engines, so the SQL cannot drift from the domain.
   * A missing category key sums as NULL, which SUM skips — the same as the
   * domain's `?? 0`.
   */
  async ratingTotals(propertyIds: string[]): Promise<Map<string, RatingTotals>> {
    if (propertyIds.length === 0) return new Map()

    const categorySumSelects = REVIEW_CATEGORIES.map(
      ({ key }) =>
        sql`COALESCE(SUM((${reviews.categories} ->> ${key})::int), 0)::int AS ${sql.identifier(`sum_${key}`)}`
    )

    // `published` only — the exclusion is the rule (#40), and it belongs in
    // the same place as the sums it changes.
    const rows = await this.db.execute<
      { property_id: string; review_count: number; rating_sum: number } & Record<string, number>
    >(sql`
      SELECT ${reviews.propertyId} AS property_id,
             COUNT(*)::int AS review_count,
             COALESCE(SUM(${reviews.rating}), 0)::int AS rating_sum,
             ${sql.join(categorySumSelects, sql`, `)}
      FROM ${reviews}
      WHERE ${reviews.propertyId} IN ${propertyIds}
        AND ${reviews.status} = 'published'
      GROUP BY ${reviews.propertyId}
    `)

    const totals = new Map<string, RatingTotals>()
    for (const row of rows.rows) {
      const categorySums: RatingTotals["categorySums"] = {}
      for (const { key } of REVIEW_CATEGORIES) {
        categorySums[key] = Number(row[`sum_${key}`] ?? 0)
      }
      totals.set(row.property_id, {
        reviewCount: Number(row.review_count),
        ratingSum: Number(row.rating_sum),
        categorySums,
      })
    }
    return totals
  }

  async listForProperties(input: {
    propertyIds: string[]
    status?: string
    limit: number
    cursor?: string
  }) {
    if (input.propertyIds.length === 0) return { rows: [], nextCursor: null }

    const where = [inArray(reviews.propertyId, input.propertyIds)]
    if (input.status) where.push(eq(reviews.status, input.status))

    return this.page({
      where,
      limit: input.limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    })
  }

  /** The moderation queue: flagged and pending, unless a status is named. */
  async listForModeration(input: { status?: string; limit: number; cursor?: string }) {
    const where = input.status
      ? [eq(reviews.status, input.status)]
      : [inArray(reviews.status, ["flagged", "pending"])]

    return this.page({
      where,
      limit: input.limit,
      ...(input.cursor !== undefined ? { cursor: input.cursor } : {}),
    })
  }

  /**
   * One paged read for every review listing.
   *
   * Keyset, not OFFSET: `OFFSET 10000` makes Postgres walk and discard ten
   * thousand rows for the last page of a busy property. The cursor carries the
   * last row's date plus its id — the id breaks ties, without which reviews
   * written on the same day repeat or vanish between pages.
   */
  private async page(input: { where: SQL[]; limit: number; cursor?: string }) {
    const cursor = decodeCursor(input.cursor)
    const where = [...input.where]
    if (cursor) {
      where.push(
        or(
          lt(reviews.date, cursor.date),
          and(eq(reviews.date, cursor.date), lt(reviews.id, cursor.id))
        )!
      )
    }

    // One extra row tells us whether another page exists without a COUNT.
    const rows = await this.db
      .select()
      .from(reviews)
      .where(and(...where))
      .orderBy(desc(reviews.date), desc(reviews.id))
      .limit(input.limit + 1)

    const hasMore = rows.length > input.limit
    const page = hasMore ? rows.slice(0, input.limit) : rows

    return { rows: page, nextCursor: hasMore ? encodeCursor(page[page.length - 1]!) : null }
  }

  /* ------------------------------------------------------------- moderate */

  /**
   * Moves a review between states.
   *
   * Guarded on the CURRENT status so two moderators acting at once cannot both
   * believe they decided it.
   */
  async setStatus(input: {
    reviewId: string
    fromStatus: string
    toStatus: string
    flagReason: string | null
  }) {
    const [row] = await this.db
      .update(reviews)
      .set({
        status: input.toStatus,
        flagReason: input.flagReason,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(reviews.id, input.reviewId), eq(reviews.status, input.fromStatus)))
      .returning()
    return row ?? null
  }

  /**
   * The author taking their own review down.
   *
   * Guarded on BOTH the author and the current status, in one statement: the
   * ownership check is part of the write, not a read before it, so nothing can
   * change underneath between the two.
   */
  async withdraw(input: { reviewId: string; userId: string; fromStatuses: string[] }) {
    const [row] = await this.db
      .update(reviews)
      .set({ status: "withdrawn", updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(reviews.id, input.reviewId),
          eq(reviews.authorId, input.userId),
          inArray(reviews.status, input.fromStatuses)
        )
      )
      .returning()
    return row ?? null
  }

  /** A response is written as a pair — the CHECK refuses half of one. */
  async setResponse(reviewId: string, text: string) {
    const now = new Date().toISOString()
    const [row] = await this.db
      .update(reviews)
      .set({ responseText: text, responseAt: now, updatedAt: now })
      .where(eq(reviews.id, reviewId))
      .returning()
    return row ?? null
  }

  /**
   * A publicly visible property, by slug.
   *
   * `active` only, and the filter is here rather than in the caller: a
   * suspended property's reviews are not public, and its guest reviews must
   * not stay readable through a second route after the listing goes dark.
   */
  async findPublicPropertyBySlug(slug: string) {
    const [row] = await this.db
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.slug, slug), eq(properties.status, "active")))
      .limit(1)
    return row ?? null
  }

  /** The properties an org owns, for scoping every partner action. */
  async propertyIdsForOrg(orgId: string, scoped: string[]): Promise<string[]> {
    const rows = await this.db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.partnerOrgId, orgId))
    const owned = rows.map((r) => r.id)
    return scoped.length === 0 ? owned : owned.filter((id) => scoped.includes(id))
  }

  /**
   * Somebody at the property who should hear about a review.
   *
   * The org's admin, because that is the account that can act on it — a
   * message to a shared mailbox nobody owns is a message nobody reads.
   */
  async propertyOwnerEmail(propertyId: string) {
    const [row] = await this.db
      .select({ userId: users.id, email: users.email })
      .from(properties)
      .innerJoin(partnerMembers, eq(partnerMembers.orgId, properties.partnerOrgId))
      .innerJoin(users, eq(users.id, partnerMembers.userId))
      .where(
        and(
          eq(properties.id, propertyId),
          eq(partnerMembers.role, "admin"),
          eq(partnerMembers.status, "active")
        )
      )
      .limit(1)
    return row ?? null
  }

  /** Author display name, taken from the account rather than the request. */
  async authorDetails(userId: string) {
    const [row] = await this.db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        avatarSeed: users.avatarSeed,
        country: users.country,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    return row ?? null
  }
}

/* ------------------------------------------------------------- cursors -- */

type ReviewCursor = { date: string; id: string }

function encodeCursor(row: ReviewRow): string {
  return Buffer.from(`${row.date} ${row.id}`, "utf8").toString("base64url")
}

function decodeCursor(cursor: string | undefined): ReviewCursor | null {
  if (!cursor) return null
  try {
    const [date, id] = Buffer.from(cursor, "base64url").toString("utf8").split(" ")
    // Shape-checked before it reaches a query: a cursor is caller-supplied
    // input like any other, and `date` lands in a comparison against a DATE
    // column, where a malformed value is an error rather than an empty page.
    if (!date || !id || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
    return { date, id }
  } catch {
    return null
  }
}
