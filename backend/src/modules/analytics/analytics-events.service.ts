import { createHash } from "node:crypto"

import { Inject, Injectable, Logger } from "@nestjs/common"
import { and, eq, isNull, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import { searchEvents, searchImpressions } from "../../db/schema"

/**
 * How many results are recorded as impressions for one search.
 *
 * The first page is what people actually look at, and a caller asking for two
 * hundred results should not turn one search into two hundred writes. Positions
 * beyond this are simply not recorded rather than recorded wrongly.
 */
const MAX_IMPRESSIONS = 50

/**
 * Recording what people searched for (rules #67, #68).
 *
 * Written from today even though the Demand and Ranking screens come later:
 * analytics does not backfill. A table created the same week as its screen has
 * nothing to show for the first quarter of its life, and "was last winter
 * busier?" is exactly the question a partner asks first.
 *
 * **Nothing here may fail a search.** Every write is awaited internally but its
 * failure is swallowed and logged — the same principle as rule #57, where the
 * notification outbox cannot stop a booking from confirming. A guest looking
 * for a hotel must not see an error because an analytics insert deadlocked.
 */
@Injectable()
export class AnalyticsEventsService {
  private readonly logger = new Logger(AnalyticsEventsService.name)

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Records a search and the properties it showed.
   *
   * Returns the event id so the client can report a click against it, or `null`
   * when the write failed — callers treat that as "no analytics this time" and
   * carry on.
   */
  async recordSearch(input: {
    destination: string
    checkIn?: string | null
    checkOut?: string | null
    adults?: number | null
    children?: number | null
    resultCount: number
    surface?: string | null
    sessionId?: string | null
    userId?: string | null
    propertyIds: readonly string[]
  }): Promise<string | null> {
    try {
      /*
       * Dates go in as a pair or not at all — the CHECK enforces it, and a
       * half-filled pair would be rejected at the database rather than here.
       * A search for a destination with no dates is perfectly ordinary.
       */
      const hasDates = Boolean(input.checkIn && input.checkOut)

      const [event] = await this.db
        .insert(searchEvents)
        .values({
          destination: input.destination.trim().toLowerCase().slice(0, 160),
          checkIn: hasDates ? input.checkIn! : null,
          checkOut: hasDates ? input.checkOut! : null,
          adults: input.adults ?? null,
          children: input.children ?? null,
          resultCount: Math.max(0, input.resultCount),
          surface: normaliseSurface(input.surface),
          sessionHash: hashSession(input.sessionId),
          userId: input.userId ?? null,
        })
        .returning({ id: searchEvents.id })

      if (!event) return null

      const shown = input.propertyIds.slice(0, MAX_IMPRESSIONS)
      if (shown.length > 0) {
        // One multi-row insert — a twenty-result page costs one round trip.
        await this.db.insert(searchImpressions).values(
          shown.map((propertyId, index) => ({
            searchEventId: event.id,
            propertyId,
            position: index + 1,
          }))
        )
      }

      return event.id
    } catch (error) {
      // Never rethrown: a guest searching for a hotel must not see an error
      // because an analytics write failed.
      this.logger.warn(`Failed to record search: ${(error as Error).message}`)
      return null
    }
  }

  /**
   * Marks that a search result was opened.
   *
   * Guarded on `clicked_at IS NULL`, so the recorded time is the FIRST click.
   * Letting a later one overwrite would turn "how quickly did they decide" into
   * "when did they last come back", which is a different question the screen
   * does not ask.
   */
  async recordClick(input: { searchEventId: string; propertyId: string }): Promise<void> {
    try {
      await this.db
        .update(searchImpressions)
        .set({ clickedAt: new Date().toISOString() })
        .where(
          and(
            eq(searchImpressions.searchEventId, input.searchEventId),
            eq(searchImpressions.propertyId, input.propertyId),
            isNull(searchImpressions.clickedAt)
          )
        )
    } catch (error) {
      this.logger.warn(`Failed to record click: ${(error as Error).message}`)
    }
  }

  /** Impressions and clicks for a property — the Ranking screen's raw material. */
  async impressionStats(input: { propertyIds: readonly string[]; from: string; to: string }) {
    if (input.propertyIds.length === 0) return []

    const ids = sql.join(
      input.propertyIds.map((id) => sql`${id}::uuid`),
      sql`, `
    )

    const result = await this.db.execute<{
      property_id: string
      impressions: number
      clicks: number
      avg_position: string | null
    }>(sql`
      SELECT property_id,
             COUNT(*)::int AS impressions,
             COUNT(clicked_at)::int AS clicks,
             AVG(position)::numeric(6,2) AS avg_position
      FROM search_impressions
      WHERE property_id IN (${ids})
        AND created_at >= ${input.from}::date
        AND created_at < ${input.to}::date + 1
      GROUP BY property_id
    `)

    return result.rows.map((row) => ({
      propertyId: row.property_id,
      impressions: row.impressions,
      clicks: row.clicks,
      avgPosition: row.avg_position === null ? null : Number(row.avg_position),
    }))
  }
}

/* ----------------------------------------------------------------- local -- */

/**
 * A session id, hashed (rule #68).
 *
 * The raw value never reaches a column. It is opaque client-generated text, so
 * hashing costs nothing and means a copy of this table cannot be joined back to
 * whatever else that id appears in.
 */
function hashSession(sessionId: string | null | undefined): string | null {
  if (!sessionId) return null
  return createHash("sha256").update(sessionId).digest("hex")
}

/** Anything unrecognised is `web` — a CHECK rejects the rest anyway. */
function normaliseSurface(value: string | null | undefined): string {
  return value === "mobile_web" || value === "app" ? value : "web"
}
