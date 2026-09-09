import type { ISODate } from "../types/common"
import type { Booking } from "../types/booking"
import type {
  PropertyRating,
  Review,
  ReviewCategories,
  ReviewCategory,
} from "../types/review"
import { REVIEW_CATEGORIES } from "../types/review"
import { daysBetween } from "./dates"

/* ============================================================================
 * Ratings and review eligibility.
 *
 * A property's rating is NEVER stored. It is derived from published reviews
 * every time it is asked for, so no screen can show a figure that a moderation
 * decision has already invalidated.
 * ========================================================================== */

const EMPTY_CATEGORIES: ReviewCategories = {
  cleanliness: 0,
  comfort: 0,
  location: 0,
  facilities: 0,
  staff: 0,
}

/** A property nobody has reviewed yet: zero, not "unrated" or `null`. */
export function emptyRating(): PropertyRating {
  return { rating: 0, reviewCount: 0, categories: { ...EMPTY_CATEGORIES } }
}

/** One decimal place — the scale the whole product displays. */
function round1(value: number): number {
  return Math.round(value * 10) / 10
}

/**
 * The raw sums a rating is built from.
 *
 * Sums rather than averages, deliberately: a database can produce these with a
 * single grouped query, and integer sums are exact in both SQL and JavaScript.
 * Averaging on the database side instead would put a second implementation of
 * the arithmetic in a second language, and floating-point division would put
 * the two a rounding step apart — 4.05 landing on 4.1 in one and 4.0 in the
 * other, on a number the whole marketplace sorts by.
 */
export type RatingTotals = {
  reviewCount: number
  ratingSum: number
  categorySums: Partial<Record<ReviewCategory, number>>
}

/**
 * A property's headline rating from pre-summed totals.
 *
 * The ONE place the arithmetic lives. `deriveRating` counts rows in memory and
 * calls this; the API counts them in SQL and calls this. Neither can drift.
 */
export function ratingFromTotals(totals: RatingTotals): PropertyRating {
  if (totals.reviewCount === 0) return emptyRating()

  const categories = {} as ReviewCategories
  for (const { key } of REVIEW_CATEGORIES) {
    categories[key] = round1((totals.categorySums[key] ?? 0) / totals.reviewCount)
  }

  return {
    rating: round1(totals.ratingSum / totals.reviewCount),
    reviewCount: totals.reviewCount,
    categories,
  }
}

/**
 * A property's headline rating, from its PUBLISHED reviews only.
 *
 * Pending, flagged and rejected reviews are excluded from both the average and
 * the count: a review a moderator has not cleared must not move a property up
 * the listings while it waits.
 */
export function deriveRating(reviews: readonly Pick<Review, "status" | "rating" | "categories">[]): PropertyRating {
  const published = reviews.filter((r) => r.status === "published")

  const categorySums: Partial<Record<ReviewCategory, number>> = {}
  for (const { key } of REVIEW_CATEGORIES) {
    categorySums[key] = published.reduce((sum, r) => sum + (r.categories[key] ?? 0), 0)
  }

  return ratingFromTotals({
    reviewCount: published.length,
    ratingSum: published.reduce((sum, r) => sum + r.rating, 0),
    categorySums,
  })
}

/** The average a single review scores across its five categories. */
export function categoryAverage(categories: ReviewCategories): number {
  const keys = REVIEW_CATEGORIES.map((c) => c.key)
  return round1(keys.reduce((sum, key) => sum + (categories[key] ?? 0), 0) / keys.length)
}

/* ----------------------------------------------------------- eligibility -- */

/** How long after checking out a guest may still write a review. */
export const REVIEW_WINDOW_DAYS = 90

export type ReviewEligibility =
  | { ok: true }
  | { ok: false; reason: "not_stayed" | "already_reviewed" | "window_closed" }

/**
 * Whether a guest may review a booking.
 *
 * Three conditions, and each one closes a real hole:
 *  - the stay must have COMPLETED — otherwise a booking could be reviewed
 *    before, or instead of, being taken
 *  - one review per booking — otherwise a single stay could be rated twice
 *  - within a window — a rating written two years later says little about the
 *    property as it stands today
 */
export function canReview(
  booking: Pick<Booking, "status" | "checkOut">,
  input: { today: ISODate; alreadyReviewed: boolean }
): ReviewEligibility {
  if (booking.status !== "completed") return { ok: false, reason: "not_stayed" }
  if (input.alreadyReviewed) return { ok: false, reason: "already_reviewed" }
  if (daysBetween(booking.checkOut, input.today) > REVIEW_WINDOW_DAYS) {
    return { ok: false, reason: "window_closed" }
  }
  return { ok: true }
}

/** Reviews that count as verified — written by someone who actually stayed. */
export function isVerified(review: Pick<Review, "bookingId">): boolean {
  return review.bookingId !== null
}

/** Valid rating values, used to guard input at the edges. */
export function isValidRating(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5
}

export function isValidCategories(categories: Partial<ReviewCategories>): boolean {
  return REVIEW_CATEGORIES.every(({ key }) => {
    const value = categories[key as ReviewCategory]
    return value !== undefined && isValidRating(value)
  })
}
