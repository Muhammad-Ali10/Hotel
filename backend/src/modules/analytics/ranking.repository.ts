import { Inject, Injectable } from "@nestjs/common"
import { AVAILABILITY_WINDOW_NIGHTS } from "@stayora/shared"
import { eq, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { properties } from "../../db/schema"

export type RankingInputRow = {
  propertyId: string
  name: string
  city: string
  listingScore: number
  rating: number
  reviewCount: number
  impressions: number
  clicks: number
  fromPrice: number
  marketMedianPrice: number
  sellableNights: number
  windowNights: number
}

/**
 * Everything the ranking is computed from (rule #104).
 *
 * One query for the whole catalogue, not one per property. The job runs over
 * every live listing, and a per-property version would be five round trips
 * times the size of the marketplace.
 *
 * Table names are spelled out because drizzle renders a column reference
 * inside a raw template WITHOUT its table qualifier, which comes out ambiguous
 * across these joins. Values are still bound as parameters.
 */
@Injectable()
export class RankingRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async inputs(input: { propertyId?: string; since: string; today: string }) {
    const result = await this.db.execute<{
      property_id: string
      name: string
      city: string
      photos: number
      description_length: number
      rooms: number
      amenities: number
      value_adds: number
      review_count: number
      rating: string
      reviews_replied: number
      impressions: number
      clicks: number
      from_price: number
      market_median: string
      sellable_nights: number
    }>(sql`
      WITH live AS (
        SELECT id, name, city, description, base_price
        FROM properties
        WHERE status = 'active'
          AND (${input.propertyId ?? null}::uuid IS NULL
               OR id = ${input.propertyId ?? null}::uuid)
      ),
      /*
       * The typical rate in each city, from EVERY live listing there — not
       * only the one being ranked. A median rather than a mean: one
       * five-thousand-dollar suite would otherwise move the whole city's
       * benchmark and mark every ordinary hotel as cheap.
       */
      market AS (
        SELECT city,
               PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY base_price) AS median
        FROM properties
        WHERE status = 'active' AND base_price > 0
        GROUP BY city
      )
      SELECT
        l.id   AS property_id,
        l.name AS name,
        l.city AS city,
        (SELECT COUNT(*)::int FROM photos ph
          WHERE ph.property_id = l.id AND ph.status = 'approved') AS photos,
        length(l.description)::int AS description_length,
        (SELECT COUNT(*)::int FROM rooms r
          WHERE r.property_id = l.id AND r.status = 'active') AS rooms,
        (SELECT COUNT(*)::int FROM property_amenities pa
          WHERE pa.property_id = l.id) AS amenities,
        (SELECT COUNT(*)::int FROM value_adds va
          WHERE va.property_id = l.id AND va.active) AS value_adds,
        (SELECT COUNT(*)::int FROM reviews rv
          WHERE rv.property_id = l.id AND rv.status = 'published') AS review_count,
        (SELECT COALESCE(AVG(rv.rating), 0) FROM reviews rv
          WHERE rv.property_id = l.id AND rv.status = 'published') AS rating,
        (SELECT COUNT(*)::int FROM reviews rv
          WHERE rv.property_id = l.id AND rv.status = 'published'
            AND rv.response_text IS NOT NULL
            AND length(trim(rv.response_text)) > 0) AS reviews_replied,
        (SELECT COUNT(*)::int FROM search_impressions si
          WHERE si.property_id = l.id AND si.created_at >= ${input.since}::timestamptz)
          AS impressions,
        (SELECT COUNT(*)::int FROM search_impressions si
          WHERE si.property_id = l.id AND si.clicked_at IS NOT NULL
            AND si.created_at >= ${input.since}::timestamptz) AS clicks,
        l.base_price AS from_price,
        COALESCE(m.median, 0) AS market_median,
        /*
         * Nights in the window with at least one unit left on any room.
         *
         * A sparse calendar means the room's own units column stands in (rule
         * #23), so a night with NO inventory row still counts as available -
         * which is why this counts DATES rather than rows.
         */
        (
          SELECT COUNT(DISTINCT d)::int
          FROM generate_series(
            ${input.today}::date,
            -- The cast is required. An untyped parameter beside a date is
            -- ambiguous between adding days and adding an interval, and
            -- Postgres refuses rather than guessing.
            ${input.today}::date + ${AVAILABILITY_WINDOW_NIGHTS - 1}::int,
            '1 day'
          ) AS d
          WHERE EXISTS (
            SELECT 1 FROM rooms r
            LEFT JOIN room_inventory ri
              ON ri.room_id = r.id AND ri.date = d::date
            WHERE r.property_id = l.id
              AND r.status = 'active'
              AND COALESCE(ri.is_closed, FALSE) = FALSE
              AND COALESCE(ri.sellable_units, r.units) > COALESCE(ri.booked_units, 0)
          )
        ) AS sellable_nights
      FROM live l
      LEFT JOIN market m ON m.city = l.city
    `)

    return result.rows.map(
      (row): RankingInputRow & { scoreInputs: Record<string, number> } => ({
        propertyId: row.property_id,
        name: row.name,
        city: row.city,
        // Aggregates come back as strings from node-postgres.
        listingScore: 0, // filled by the service, which owns `listingScore`
        rating: Number(row.rating),
        reviewCount: row.review_count,
        impressions: row.impressions,
        clicks: row.clicks,
        fromPrice: row.from_price,
        marketMedianPrice: Math.round(Number(row.market_median)),
        sellableNights: row.sellable_nights,
        windowNights: AVAILABILITY_WINDOW_NIGHTS,
        scoreInputs: {
          photos: row.photos,
          descriptionLength: row.description_length,
          rooms: row.rooms,
          amenities: row.amenities,
          valueAdds: row.value_adds,
          reviewCount: row.review_count,
          rating: Number(row.rating),
          reviewsReplied: row.reviews_replied,
        },
      })
    )
  }

  /** Writes one property's score. The job calls this per row. */
  async setScore(input: { propertyId: string; score: number }) {
    await this.db
      .update(properties)
      .set({ rankingScore: input.score, rankedAt: new Date().toISOString() })
      .where(eq(properties.id, input.propertyId))
  }

  /**
   * Where this property sits among the live listings in its own city.
   *
   * Rank rather than score, because "you are 3rd of 24 in New York" is the
   * only form of this a partner can act on. A raw 6,240 out of 10,000 means
   * nothing without knowing what everybody else scored.
   */
  async placeInCity(propertyId: string) {
    const result = await this.db.execute<{
      position: number
      total: number
      city: string
    }>(sql`
      WITH ranked AS (
        SELECT id, city,
               RANK() OVER (PARTITION BY city ORDER BY ranking_score DESC) AS position,
               COUNT(*) OVER (PARTITION BY city) AS total
        FROM properties
        WHERE status = 'active'
      )
      SELECT position::int, total::int, city FROM ranked WHERE id = ${propertyId}::uuid
    `)

    const row = result.rows[0]
    return row ? { position: row.position, total: row.total, city: row.city } : null
  }

  /* ---------------------------------------------------------------- demand */

  /**
   * What people searched for, and whether anything came back.
   *
   * The zero-result searches are the point of this screen: a destination
   * people keep asking for and nobody serves is the clearest signal a
   * marketplace gets, and it is invisible in booking data.
   */
  async demandByDestination(input: { from: string; to: string; limit: number; city?: string }) {
    const result = await this.db.execute<{
      destination: string
      searches: number
      empty: number
      avg_results: string
      travellers: number
    }>(sql`
      SELECT
        destination,
        COUNT(*)::int AS searches,
        COUNT(*) FILTER (WHERE result_count = 0)::int AS empty,
        COALESCE(AVG(result_count), 0) AS avg_results,
        COUNT(DISTINCT COALESCE(session_hash, id::text))::int AS travellers
      FROM search_events
      WHERE created_at >= ${input.from}::date
        AND created_at < (${input.to}::date + 1)
        AND (${input.city ?? null}::text IS NULL OR destination ILIKE ${input.city ?? null})
      GROUP BY destination
      ORDER BY searches DESC
      LIMIT ${input.limit}
    `)

    return result.rows.map((row) => ({
      destination: row.destination,
      searches: row.searches,
      emptyResults: row.empty,
      averageResults: Math.round(Number(row.avg_results) * 10) / 10,
      travellers: row.travellers,
    }))
  }

  /** The same searches over time, for a trend line. */
  async demandOverTime(input: { from: string; to: string; city?: string }) {
    const result = await this.db.execute<{
      period: string
      searches: number
      empty: number
    }>(sql`
      SELECT
        to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS period,
        COUNT(*)::int AS searches,
        COUNT(*) FILTER (WHERE result_count = 0)::int AS empty
      FROM search_events
      WHERE created_at >= ${input.from}::date
        AND created_at < (${input.to}::date + 1)
        AND (${input.city ?? null}::text IS NULL OR destination ILIKE ${input.city ?? null})
      GROUP BY 1
      ORDER BY 1
    `)

    return result.rows.map((row) => ({
      period: row.period,
      searches: row.searches,
      emptyResults: row.empty,
    }))
  }
}
