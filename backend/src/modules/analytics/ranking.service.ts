import { ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import {
  listingScore,
  rankProperty,
  weakestFactor,
  type Ranking,
  type RankingFactor,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { AnalyticsRepository } from "./analytics.repository"
import { RankingRepository } from "./ranking.repository"

/** How far back the click-through window looks. */
const CONVERSION_WINDOW_DAYS = 90

export type RankingView = {
  propertyId: string
  name: string
  city: string
  score: number
  position: number | null
  total: number | null
  factors: RankingFactor[]
  /** The one worth fixing, weighted. */
  weakest: RankingFactor | null
  rankedAt: string | null
}

/**
 * Search ranking, and the screen that explains it (rule #104).
 *
 * The score is materialised by `refreshAll`, which the nightly job runs. This
 * service also computes a LIVE ranking for one property on demand, so the
 * partner's screen shows today's answer rather than last night's — the
 * explanation and the sort can differ by a day, and saying so is better than
 * quietly showing stale reasons for a stale position.
 */
@Injectable()
export class RankingService {
  private readonly logger = new Logger(RankingService.name)

  constructor(
    private readonly repo: RankingRepository,
    private readonly analytics: AnalyticsRepository
  ) {}

  /**
   * Recomputes every live listing's score.
   *
   * One pass, one query for the inputs. Written per row rather than in a
   * single UPDATE because the scoring is a pure function in `shared` — the
   * alternative is a second copy of it in SQL, and the two would drift the
   * first time a weight changed.
   */
  async refreshAll(now = new Date()) {
    const rows = await this.repo.inputs({
      since: since(now, CONVERSION_WINDOW_DAYS),
      today: now.toISOString().slice(0, 10),
    })

    let updated = 0
    for (const row of rows) {
      const ranking = this.rank(row)
      await this.repo.setScore({ propertyId: row.propertyId, score: ranking.score })
      updated += 1
    }

    this.logger.log(`Ranked ${updated} listings`)
    return { ranked: updated }
  }

  /**
   * One property's ranking, with the working shown.
   *
   * Every factor, its weight and what it contributed — because a ranking a
   * partner cannot check is one they argue with, and "improve your visibility"
   * with no numbers behind it is the least actionable sentence a marketplace
   * can print.
   */
  async forProperty(input: {
    user: AuthenticatedUser
    propertyId: string
    now?: Date
  }): Promise<RankingView> {
    if (!input.user.partner) {
      throw new ForbiddenException("This account is not linked to a property")
    }

    const allowed = await this.analytics.scopedPropertyIds(
      input.user.partner.orgId,
      input.user.partner.propertyIds
    )
    // 404 rather than 403 — a 403 confirms the id belongs to somebody (API1).
    if (!allowed.includes(input.propertyId)) throw new NotFoundException("Property not found")

    const now = input.now ?? new Date()
    const [row] = await this.repo.inputs({
      propertyId: input.propertyId,
      since: since(now, CONVERSION_WINDOW_DAYS),
      today: now.toISOString().slice(0, 10),
    })
    if (!row) throw new NotFoundException("Property not found")

    const ranking = this.rank(row)
    const place = await this.repo.placeInCity(input.propertyId)

    return {
      propertyId: row.propertyId,
      name: row.name,
      city: row.city,
      score: ranking.score,
      /*
       * The POSITION comes from the materialised column, the FACTORS from a
       * live computation. They can disagree by a day, which is honest: the
       * sort really is last night's, and the reasons really are today's.
       */
      position: place?.position ?? null,
      total: place?.total ?? null,
      factors: ranking.factors,
      weakest: weakestFactor(ranking),
      rankedAt: null,
    }
  }

  /* ---------------------------------------------------------------- demand */

  /**
   * What travellers searched for (rule #67).
   *
   * A partner sees their OWN cities only. "How much demand is there for
   * Lahore" is a fair question for somebody who runs a hotel in Lahore; the
   * whole market's demand map is the platform's own asset.
   */
  async demandForPartner(input: {
    user: AuthenticatedUser
    from: string
    to: string
  }) {
    if (!input.user.partner) {
      throw new ForbiddenException("This account is not linked to a property")
    }

    const cities = await this.analytics.citiesFor(
      input.user.partner.orgId,
      input.user.partner.propertyIds
    )
    if (cities.length === 0) return { cities: [], destinations: [], trend: [] }

    const [destinations, trend] = await Promise.all([
      Promise.all(
        cities.map((city) =>
          this.repo.demandByDestination({ from: input.from, to: input.to, limit: 1, city })
        )
      ).then((groups) => groups.flat()),
      this.repo.demandOverTime({ from: input.from, to: input.to, city: cities[0] }),
    ])

    return { cities, destinations, trend }
  }

  /** The same question with the scope taken off (rule #84). */
  async demandForPlatform(input: { from: string; to: string; limit: number }) {
    const [destinations, trend] = await Promise.all([
      this.repo.demandByDestination({ from: input.from, to: input.to, limit: input.limit }),
      this.repo.demandOverTime({ from: input.from, to: input.to }),
    ])
    return { destinations, trend }
  }

  /* ----------------------------------------------------------------- local */

  private rank(row: Awaited<ReturnType<RankingRepository["inputs"]>>[number]): Ranking {
    // The listing score is rule #99's, not a second definition of "good page".
    const quality = listingScore({
      photos: row.scoreInputs.photos!,
      descriptionLength: row.scoreInputs.descriptionLength!,
      rooms: row.scoreInputs.rooms!,
      amenities: row.scoreInputs.amenities!,
      valueAdds: row.scoreInputs.valueAdds!,
      reviewCount: row.scoreInputs.reviewCount!,
      rating: row.scoreInputs.rating!,
      reviewsReplied: row.scoreInputs.reviewsReplied!,
    })

    return rankProperty({
      listingScore: quality.total,
      rating: row.rating,
      reviewCount: row.reviewCount,
      impressions: row.impressions,
      clicks: row.clicks,
      fromPrice: row.fromPrice,
      marketMedianPrice: row.marketMedianPrice,
      sellableNights: row.sellableNights,
      windowNights: row.windowNights,
    })
  }
}

function since(now: Date, days: number): string {
  const d = new Date(now)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString()
}
