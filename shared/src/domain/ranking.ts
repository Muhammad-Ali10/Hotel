import type { Cents } from "../types/common"

/* ============================================================================
 * Search ranking (rule #104).
 *
 * A ranking that search does not USE is a report about nothing, so this drives
 * the `recommended` sort as well as the partner's own ranking screen. Before
 * it existed, `recommended` quietly fell back to `price_asc`.
 *
 * Five factors, and every one of them is something the platform already
 * measures. Nothing here is bought: paid placement is a separate product and
 * a separate decision, and mixing it in would make this score unexplainable.
 * ========================================================================== */

export type RankingFactorKey =
  | "quality"
  | "rating"
  | "conversion"
  | "price"
  | "availability"

export type RankingInputs = {
  /** 0–100 from `listingScore` (rule #99) — how well the page is built. */
  listingScore: number

  /** Published reviews only (rule #40). */
  rating: number
  reviewCount: number

  /** Search results shown, and how often somebody clicked through. */
  impressions: number
  clicks: number

  /** This property's cheapest rate, and the median across its city. */
  fromPrice: Cents
  marketMedianPrice: Cents

  /** Nights with something left to sell in the next `AVAILABILITY_WINDOW`. */
  sellableNights: number
  windowNights: number
}

export type RankingFactor = {
  key: RankingFactorKey
  label: string
  /** 0–100. */
  score: number
  weight: number
  /** How much of the final score this factor contributed, 0–100. */
  contribution: number
  detail: string
}

export type Ranking = {
  /** 0–10000, so it can live in an integer column and sort in the database. */
  score: number
  factors: RankingFactor[]
}

export const RANKING_WEIGHTS: Record<RankingFactorKey, number> = {
  quality: 25,
  rating: 25,
  conversion: 20,
  price: 15,
  availability: 15,
}

/** How far ahead "does it have anything left to sell" looks. */
export const AVAILABILITY_WINDOW_NIGHTS = 60

/**
 * How much evidence a rate needs before it is believed.
 *
 * A listing with three impressions and one click converts at 33%, which would
 * beat a mature listing at 8% on ten thousand impressions — on noise. Both
 * rates are pulled toward the market average in proportion to how little
 * evidence they have, so a small sample says almost nothing and a large one
 * says almost everything.
 *
 * This is the same shape as a Bayesian prior, done by hand: `PRIOR_*` is the
 * number of imaginary observations every listing starts with.
 */
export const PRIOR_IMPRESSIONS = 200
export const PRIOR_REVIEWS = 10

/** What the market converts at before anybody has been measured. */
export const BASELINE_CONVERSION = 0.05
/** The middle of a five-point scale, for a listing nobody has reviewed. */
export const BASELINE_RATING = 3.5

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * A rate, pulled toward a baseline by how little evidence supports it.
 *
 * `(observed + prior * baseline) / (total + prior)`.
 */
function smoothed(observed: number, total: number, prior: number, baseline: number): number {
  return (observed + prior * baseline) / (total + prior)
}

export function rankProperty(input: RankingInputs): Ranking {
  /* ------------------------------------------------------------- quality */

  const quality = clamp(input.listingScore)

  /* -------------------------------------------------------------- rating */

  const smoothedRating = smoothed(
    input.rating * input.reviewCount,
    input.reviewCount,
    PRIOR_REVIEWS,
    BASELINE_RATING
  )
  const ratingScore = clamp((smoothedRating / 5) * 100)

  /* ---------------------------------------------------------- conversion */

  const rate = smoothed(input.clicks, input.impressions, PRIOR_IMPRESSIONS, BASELINE_CONVERSION)
  /*
   * Scored against twice the baseline rather than against 100%.
   *
   * A search result that converts at 10% is doing very well; scoring it out of
   * 100% would give it 10 and make the factor almost inert for everybody.
   */
  const conversionScore = clamp((rate / (BASELINE_CONVERSION * 2)) * 100)

  /* --------------------------------------------------------------- price */

  /*
   * Cheaper than the city median scores higher, but gently.
   *
   * A hotel at half the median gets 100; one at double gets 0. Deliberately
   * only 15% of the weight: a marketplace that ranked hardest on price would
   * teach every partner that the way to be seen is to undercut, and the
   * catalogue would race to the bottom.
   */
  const priceScore =
    input.marketMedianPrice > 0 && input.fromPrice > 0
      ? clamp(100 - ((input.fromPrice / input.marketMedianPrice - 0.5) / 1.5) * 100)
      : 50

  /* -------------------------------------------------------- availability */

  const availabilityScore =
    input.windowNights > 0
      ? clamp((input.sellableNights / input.windowNights) * 100)
      : 0

  const parts: { key: RankingFactorKey; label: string; score: number; detail: string }[] = [
    {
      key: "quality",
      label: "Listing quality",
      score: quality,
      detail: `Your page scores ${Math.round(quality)} out of 100.`,
    },
    {
      key: "rating",
      label: "Guest rating",
      score: ratingScore,
      detail:
        input.reviewCount > 0
          ? `${input.rating.toFixed(1)} out of 5 across ${input.reviewCount} ${
              input.reviewCount === 1 ? "review" : "reviews"
            }.`
          : "No reviews yet — this counts as average until there are some.",
    },
    {
      key: "conversion",
      label: "Click-through",
      score: conversionScore,
      detail:
        input.impressions > 0
          ? `${input.clicks} of ${input.impressions} people who saw you in search opened your page.`
          : "You have not appeared in search yet.",
    },
    {
      key: "price",
      label: "Price against the market",
      score: priceScore,
      detail:
        input.marketMedianPrice > 0
          ? `Your cheapest rate is ${Math.round(
              (input.fromPrice / input.marketMedianPrice) * 100
            )}% of the typical rate in your city.`
          : "Not enough properties in your city to compare.",
    },
    {
      key: "availability",
      label: "Rooms left to sell",
      score: availabilityScore,
      detail: `${input.sellableNights} of the next ${input.windowNights} nights have something available.`,
    },
  ]

  const factors: RankingFactor[] = parts.map((part) => ({
    ...part,
    weight: RANKING_WEIGHTS[part.key],
    contribution: (part.score * RANKING_WEIGHTS[part.key]) / 100,
  }))

  const total = factors.reduce((sum, f) => sum + f.contribution, 0)

  return {
    // 0–10000, so the database can hold it as an integer and ORDER BY it
    // without a floating-point comparison deciding two close listings.
    score: Math.round(total * 100),
    factors,
  }
}

/**
 * The single factor most worth fixing.
 *
 * The one furthest from full marks WEIGHTED — telling a partner to improve a
 * factor worth 15% when they are losing 20 points on one worth 25% sends them
 * to the wrong screen.
 */
export function weakestFactor(ranking: Ranking): RankingFactor | null {
  if (ranking.factors.length === 0) return null
  return ranking.factors.reduce((worst, f) =>
    (100 - f.score) * f.weight > (100 - worst.score) * worst.weight ? f : worst
  )
}
