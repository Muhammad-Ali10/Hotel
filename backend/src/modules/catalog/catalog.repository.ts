import { Inject, Injectable } from "@nestjs/common"
import { datesInRange, type ISODate, type PropertySearchInput } from "@stayora/shared"
import { and, asc, desc, eq, gte, inArray, lte, or, sql, type SQL } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  amenities,
  photos,
  properties,
  propertyAmenities,
  ratePlans,
  reviews,
  roomInventory,
  rooms,
  valueAdds,
} from "../../db/schema"

/** Only `active` properties are ever visible to a guest. */
const PUBLICLY_VISIBLE = eq(properties.status, "active")

export type PropertyRow = typeof properties.$inferSelect

@Injectable()
export class CatalogRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ---------------------------------------------------------------- search */

  /**
   * Catalogue search.
   *
   * Amenities are matched with a HAVING count rather than one join per slug:
   * "has all of wifi, pool, spa" as three joins multiplies the row count and
   * degrades fast as a guest ticks more boxes.
   */
  /**
   * The cities this marketplace actually sells in.
   *
   * Grouped over live properties only, so the count on a home-page card is the
   * number of hotels somebody would find after clicking it. The alternative —
   * a hand-written list of glamorous destinations with invented counts — puts
   * a number on the front page that the very next screen contradicts.
   *
   * `fromPrice` is the cheapest live rate in that city, which is what a "from
   * $X" label on the card means.
   */
  async destinations(limit: number) {
    return this.db
      .select({
        city: properties.city,
        country: properties.country,
        properties: sql<number>`COUNT(*)::int`,
        fromPrice: sql<number>`MIN(${properties.basePrice})::int`,
        /* A stable image seed: the same city always draws the same picture. */
        seed: sql<string>`MIN(${properties.slug})`,
      })
      .from(properties)
      .where(PUBLICLY_VISIBLE)
      .groupBy(properties.city, properties.country)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit)
  }

  /**
   * What the platform can prove about itself (rule #113).
   *
   * The public pages carried figures nobody could check — "2,400+ properties",
   * "68 countries", "1.2 million guests", "4.8 out of 5" — on a catalogue of
   * eight properties in two countries with no published reviews. A visitor who
   * clicked through from `/about` to the search results found the contradiction
   * in one step.
   *
   * Only what is already public is counted. There is deliberately no guest or
   * booking count here: those are commercially sensitive, and a marketplace
   * that publishes how few customers it has is not being honest so much as
   * careless.
   */
  async platformStats() {
    const [catalogue] = await this.db
      .select({
        properties: sql<number>`COUNT(*)::int`,
        countries: sql<number>`COUNT(DISTINCT ${properties.country})::int`,
        cities: sql<number>`COUNT(DISTINCT ${properties.city})::int`,
      })
      .from(properties)
      .where(PUBLICLY_VISIBLE)

    const [feedback] = await this.db
      .select({
        reviews: sql<number>`COUNT(*)::int`,
        /* NULL until somebody has actually left one — not 0, which would render
           as a rating of zero stars rather than as "no rating yet". */
        averageRating: sql<number | null>`ROUND(AVG(${reviews.rating})::numeric, 1)::float8`,
      })
      .from(reviews)
      .where(eq(reviews.status, "published"))

    return {
      properties: catalogue?.properties ?? 0,
      countries: catalogue?.countries ?? 0,
      cities: catalogue?.cities ?? 0,
      reviews: feedback?.reviews ?? 0,
      averageRating: feedback?.averageRating ?? null,
    }
  }

  async search(input: PropertySearchInput) {
    const where: SQL[] = [PUBLICLY_VISIBLE]

    if (input.city) where.push(eq(properties.city, input.city))
    if (input.country) where.push(eq(properties.country, input.country))
    if (input.type) where.push(eq(properties.type, input.type))
    if (input.minPrice !== undefined) where.push(gte(properties.basePrice, input.minPrice))
    if (input.maxPrice !== undefined) where.push(lte(properties.basePrice, input.maxPrice))
    if (input.minStars !== undefined) where.push(gte(properties.stars, input.minStars))

    if (input.amenities?.length) {
      const required = input.amenities
      where.push(
        sql`(
          SELECT COUNT(DISTINCT ${amenities.slug})
          FROM ${propertyAmenities}
          JOIN ${amenities} ON ${amenities.id} = ${propertyAmenities.amenityId}
          WHERE ${propertyAmenities.propertyId} = ${properties.id}
            AND ${amenities.slug} IN ${required}
        ) = ${required.length}`
      )
    }

    /*
     * Available, not merely matching.
     *
     * Search used to answer a different question from the one being asked: it
     * listed hotels that fit the filters, whether or not a single room was
     * free. A guest narrowed to five stars in New York, chose one, and learned
     * on the property page that it was full for their week — after choosing.
     *
     * A property qualifies when it has AT LEAST ONE room that can hold the
     * party and is open on EVERY night of the stay. Counting the qualifying
     * nights and comparing to the length of the stay is what makes it every
     * night rather than any night: a room free on four nights of a five-night
     * stay is not a room this guest can book.
     *
     * `booked_units < sellable_units` is the same comparison the overbooking
     * CHECK makes at write time. This is advisory — by the time it answers,
     * the snapshot is already stale, and it is meant to be: the constraint
     * inside the booking transaction is the one that can actually say no.
     * What this does is stop showing people hotels they cannot have.
     */
    if (input.checkIn && input.checkOut) {
      const adults = input.adults ?? 1
      const guests = adults + (input.children ?? 0)
      const nights = datesInRange(input.checkIn as ISODate, input.checkOut as ISODate).length

      where.push(sql`EXISTS (
        SELECT 1
        FROM ${rooms} r
        WHERE r.property_id = ${properties.id}
          AND r.status = 'active'
          AND r.max_adults >= ${adults}
          AND r.max_occupancy >= ${guests}
          AND (
            SELECT COUNT(*)
            FROM ${roomInventory} i
            WHERE i.room_id = r.id
              AND i.date >= ${input.checkIn}::date
              AND i.date < ${input.checkOut}::date
              AND COALESCE(i.is_closed, false) = false
              AND i.booked_units < i.sellable_units
          ) = ${nights}
      )`)
    }

    const cursor = decodeCursor(input.cursor)
    if (cursor) where.push(keysetFor(input.sort, cursor))

    // One extra row tells us whether another page exists without a COUNT.
    const rows = await this.db
      .select()
      .from(properties)
      .where(and(...where))
      .orderBy(...orderFor(input.sort))
      .limit(input.limit + 1)

    const hasMore = rows.length > input.limit
    const page = hasMore ? rows.slice(0, input.limit) : rows

    return {
      rows: page,
      nextCursor: hasMore ? encodeCursor(input.sort, page[page.length - 1]!) : null,
    }
  }

  /**
   * Amenity slugs for a set of properties, in ONE query.
   *
   * The obvious alternative — fetching them per card — is an N+1: a 20-result
   * page becomes 21 round trips, and nobody notices until the list is slow
   * with real data.
   */
  async amenitySlugsFor(propertyIds: string[]): Promise<Map<string, string[]>> {
    const grouped = new Map<string, string[]>()
    if (propertyIds.length === 0) return grouped

    const rows = await this.db
      .select({ propertyId: propertyAmenities.propertyId, slug: amenities.slug })
      .from(propertyAmenities)
      .innerJoin(amenities, eq(amenities.id, propertyAmenities.amenityId))
      .where(and(inArray(propertyAmenities.propertyId, propertyIds), eq(amenities.active, true)))
      .orderBy(asc(amenities.position), asc(amenities.slug))

    for (const row of rows) {
      const list = grouped.get(row.propertyId) ?? []
      list.push(row.slug)
      grouped.set(row.propertyId, list)
    }
    return grouped
  }

  /* ---------------------------------------------------------------- detail */

  /**
   * By id, and only if a guest may see it.
   *
   * The saved list works in ids because the heart sits on a card that already
   * has one. Same visibility rule as the slug lookup, deliberately — two ways
   * in must not mean two answers to "is this public".
   */
  async findPublicById(id: string) {
    const [row] = await this.db
      .select()
      .from(properties)
      .where(and(eq(properties.id, id), PUBLICLY_VISIBLE))
      .limit(1)
    return row ?? null
  }

  async findPublicBySlug(slug: string) {
    const [row] = await this.db
      .select()
      .from(properties)
      .where(and(eq(properties.slug, slug), PUBLICLY_VISIBLE))
      .limit(1)
    return row ?? null
  }

  async amenitiesFor(propertyId: string) {
    return this.db
      .select({
        slug: amenities.slug,
        label: amenities.label,
        category: amenities.category,
        icon: amenities.icon,
      })
      .from(propertyAmenities)
      .innerJoin(amenities, eq(amenities.id, propertyAmenities.amenityId))
      .where(and(eq(propertyAmenities.propertyId, propertyId), eq(amenities.active, true)))
      .orderBy(asc(amenities.position), asc(amenities.label))
  }

  /** Rooms and their rate plans together — one query, not one per room. */
  async roomsWithRatePlans(propertyId: string) {
    return this.db
      .select({ room: rooms, ratePlan: ratePlans })
      .from(rooms)
      .leftJoin(
        ratePlans,
        and(eq(ratePlans.roomId, rooms.id), eq(ratePlans.status, "active"))
      )
      .where(eq(rooms.propertyId, propertyId))
      .orderBy(asc(rooms.createdAt), desc(ratePlans.isDefault), asc(ratePlans.basePrice))
  }

  /**
   * The photos a GUEST may see — approved only (rule #73).
   *
   * The status filter is the whole point of the review state. Without it a
   * partner uploads a photo and it is live to the public that second, which
   * makes an approved listing an approved listing exactly once: every image on
   * it could be swapped the next morning and nothing would notice.
   */
  async photosFor(propertyId: string) {
    return this.db
      .select()
      .from(photos)
      .where(and(eq(photos.propertyId, propertyId), eq(photos.status, "approved")))
      .orderBy(asc(photos.position))
  }

  async valueAddsFor(propertyId: string) {
    return this.db
      .select()
      .from(valueAdds)
      .where(and(eq(valueAdds.propertyId, propertyId), eq(valueAdds.active, true)))
      .orderBy(asc(valueAdds.name))
  }

  /* --------------------------------------------------------------- partner */

  /**
   * A property scoped to the caller's org — and, when their membership is
   * property-scoped, to the properties they may touch.
   *
   * The scope is IN THE QUERY, not an `if` in the service (docs/ARCHITECTURE.md
   * §5, API1). A row that does not belong to them simply does not exist as far
   * as this method is concerned, so a caller who forgets to check cannot leak
   * one. It also means the caller returns 404 rather than 403 — a 403 would
   * confirm the id is real.
   */
  async findForPartner(input: { propertyId: string; orgId: string; propertyIds: string[] }) {
    const scope: SQL[] = [
      eq(properties.id, input.propertyId),
      eq(properties.partnerOrgId, input.orgId),
    ]
    // Empty = every property the org owns.
    if (input.propertyIds.length > 0) {
      scope.push(inArray(properties.id, input.propertyIds))
    }

    const [row] = await this.db
      .select()
      .from(properties)
      .where(and(...scope))
      .limit(1)
    return row ?? null
  }

  async listForPartner(input: { orgId: string; propertyIds: string[] }) {
    const scope: SQL[] = [eq(properties.partnerOrgId, input.orgId)]
    if (input.propertyIds.length > 0) {
      scope.push(inArray(properties.id, input.propertyIds))
    }
    return this.db
      .select({
        property: properties,
        /*
         * Sellable units across the property's active rooms.
         *
         * Every extranet list shows it — the portfolio page, the property
         * switcher — and a subquery here is one round trip rather than one per
         * property once the partner has a dozen.
         */
        /*
         * `properties.id` is written out as `properties.id`, not interpolated.
         *
         * Drizzle renders a column reference inside a raw template WITHOUT its
         * table qualifier — so `r.property_id = id` bound to `rooms.id` in the
         * subquery's own scope and matched nothing. Every property came back
         * with zero rooms, and it typechecked perfectly.
         */
        rooms: sql<number>`(
          SELECT COALESCE(SUM(r.units), 0)::int FROM rooms r
          WHERE r.property_id = properties.id AND r.status = 'active'
        )`,
        roomTypes: sql<number>`(
          SELECT COUNT(*)::int FROM rooms r
          WHERE r.property_id = properties.id AND r.status = 'active'
        )`,
      })
      .from(properties)
      .where(and(...scope))
      .orderBy(asc(properties.name))
  }

  async updateProperty(propertyId: string, patch: Partial<PropertyRow>) {
    const [row] = await this.db
      .update(properties)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(properties.id, propertyId))
      .returning()
    return row ?? null
  }

  async findAmenityIdsBySlug(slugs: string[]) {
    if (slugs.length === 0) return []
    return this.db
      .select({ id: amenities.id, slug: amenities.slug })
      .from(amenities)
      .where(and(inArray(amenities.slug, slugs), eq(amenities.active, true)))
  }

  /** Replaces a property's amenity set in one transaction. */
  async replaceAmenities(propertyId: string, amenityIds: string[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(propertyAmenities).where(eq(propertyAmenities.propertyId, propertyId))
      if (amenityIds.length > 0) {
        await tx
          .insert(propertyAmenities)
          .values(amenityIds.map((amenityId) => ({ propertyId, amenityId })))
      }
    })
  }

  /**
   * Recomputes the denormalised "from" price from the property's active rate
   * plans. Called after any rate-plan change, never set by hand (rule #138).
   *
   * What "from $X" MEANS here, decided rather than defaulted (rule #139):
   * the cheapest ADVERTISED rate — the lowest `base_price` across active plans
   * on active rooms.
   *
   * Two things can take a real booking BELOW it, and both are deliberately
   * excluded:
   *
   *   · a single-occupancy discount in the occupancy matrix, which prices a
   *     lone traveller under the base occupancy;
   *   · a calendar override that discounts a particular date range.
   *
   * Including them would mean advertising a price that exists only for one
   * party size in one week — and search takes neither dates nor guest count
   * today, so there is nothing for such a number to be true of. The day search
   * accepts them, this definition should be revisited with it; until then the
   * headline is the standard-occupancy, undiscounted rate.
   */
  async recomputeBasePrice(propertyId: string) {
    await this.db
      .update(properties)
      .set({
        basePrice: sql`COALESCE((
          SELECT MIN(${ratePlans.basePrice})
          FROM ${ratePlans}
          JOIN ${rooms} ON ${rooms.id} = ${ratePlans.roomId}
          WHERE ${rooms.propertyId} = ${properties.id}
            AND ${ratePlans.status} = 'active'
            AND ${rooms.status} = 'active'
        ), 0)`,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(properties.id, propertyId))
  }
}

/* ------------------------------------------------------------- pagination -- */

type Cursor = { value: string; id: string }

/**
 * Keyset pagination, never OFFSET.
 *
 * `OFFSET 10000` makes Postgres walk and discard ten thousand rows on every
 * page. A keyset carries the last row's sort value plus its id — the id breaks
 * ties, without which rows with equal prices can repeat or vanish between
 * pages.
 */
function encodeCursor(sort: PropertySearchInput["sort"], row: PropertyRow): string {
  const value =
    sort === "name_asc"
      ? row.name
      : sort === "recommended"
        ? String(row.rankingScore)
        : String(row.basePrice)
  return Buffer.from(`${value}\0${row.id}`, "utf8").toString("base64url")
}

function decodeCursor(cursor: string | undefined): Cursor | null {
  if (!cursor) return null
  try {
    const [value, id] = Buffer.from(cursor, "base64url").toString("utf8").split("\0")
    if (!value || !id) return null
    return { value, id }
  } catch {
    // A malformed cursor is a bad request, not a server error — but from here
    // the safest reading is "start from the beginning".
    return null
  }
}

function keysetFor(sort: PropertySearchInput["sort"], cursor: Cursor): SQL {
  if (sort === "recommended") {
    // Descending score, ties broken by id — the same shape as `price_desc`,
    // and the tiebreak is what stops a page boundary repeating or skipping a
    // listing when two of them score identically.
    const score = Number(cursor.value)
    return or(
      sql`${properties.rankingScore} < ${score}`,
      and(eq(properties.rankingScore, score), sql`${properties.id} > ${cursor.id}`)
    )!
  }
  if (sort === "name_asc") {
    return or(
      sql`${properties.name} > ${cursor.value}`,
      and(eq(properties.name, cursor.value), sql`${properties.id} > ${cursor.id}`)
    )!
  }
  const price = Number(cursor.value)
  if (sort === "price_desc") {
    return or(
      sql`${properties.basePrice} < ${price}`,
      and(eq(properties.basePrice, price), sql`${properties.id} > ${cursor.id}`)
    )!
  }
  return or(
    sql`${properties.basePrice} > ${price}`,
    and(eq(properties.basePrice, price), sql`${properties.id} > ${cursor.id}`)
  )!
}

function orderFor(sort: PropertySearchInput["sort"]) {
  switch (sort) {
    case "recommended":
      return [desc(properties.rankingScore), asc(properties.id)]
    case "name_asc":
      return [asc(properties.name), asc(properties.id)]
    case "price_desc":
      return [desc(properties.basePrice), asc(properties.id)]
    case "price_asc":
      return [asc(properties.basePrice), asc(properties.id)]
    default:
      return [desc(properties.rankingScore), asc(properties.id)]
  }
}
