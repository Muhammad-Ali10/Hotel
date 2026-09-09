/* ============================================================================
 * The listing score (rule #99).
 *
 * ONE definition, used by the partner's own score page and by the platform's
 * content screen. Two implementations would be two numbers for the same
 * listing, and the partner would be told to fix something the platform was not
 * measuring.
 *
 * This scores the LISTING out of 100 — how well the page is built. It is not
 * the guest rating, which is out of 5 and measures something else entirely.
 * ========================================================================== */

export type ScoreInputs = {
  photos: number
  descriptionLength: number
  rooms: number
  amenities: number
  valueAdds: number
  /** Published reviews only. `0` means "not yet", not "badly". */
  reviewCount: number
  /** Out of 5, across published reviews. */
  rating: number
  /** Published reviews the property has replied to. */
  reviewsReplied: number
}

export type ScoreCategory = {
  key: ScoreKey
  name: string
  /** `null` when there is nothing to measure yet — see `applicable`. */
  score: number | null
  weight: number
  /**
   * Whether this category counts towards the total.
   *
   * A listing with no reviews yet is not a listing with BAD reviews. Scoring
   * it zero drags the total down for something the partner cannot act on, and
   * a score somebody cannot improve is one they stop reading.
   */
  applicable: boolean
  tip: string
}

export type ListingScore = {
  /** 0–100, weighted across the applicable categories only. */
  total: number
  band: "excellent" | "good" | "needs_work"
  categories: ScoreCategory[]
}

export type ScoreKey =
  | "photos"
  | "description"
  | "rooms"
  | "amenities"
  | "extras"
  | "reviews"
  | "responses"

/** What "good enough" means for each, and how much it matters. */
const TARGETS = {
  photos: { target: 8, weight: 20 },
  description: { target: 400, weight: 20 },
  rooms: { target: 4, weight: 15 },
  amenities: { target: 10, weight: 15 },
  extras: { target: 5, weight: 10 },
  reviews: { weight: 10 },
  responses: { weight: 10 },
} as const

/** The band a total falls in. 60 is the line the publish minimum draws. */
export function scoreBand(total: number): ListingScore["band"] {
  if (total >= 85) return "excellent"
  if (total >= 60) return "good"
  return "needs_work"
}

function pct(value: number, target: number): number {
  if (target <= 0) return 100
  return Math.min(100, Math.round((value / target) * 100))
}

function shortfall(value: number, target: number, noun: string, plural = `${noun}s`): string {
  const missing = target - value
  if (missing <= 0) return ""
  return `Add ${missing} more ${missing === 1 ? noun : plural}.`
}

export function listingScore(input: ScoreInputs): ListingScore {
  const categories: ScoreCategory[] = [
    {
      key: "photos",
      name: "Photos",
      score: pct(input.photos, TARGETS.photos.target),
      weight: TARGETS.photos.weight,
      applicable: true,
      tip:
        input.photos >= TARGETS.photos.target
          ? "Your gallery is well covered."
          : shortfall(input.photos, TARGETS.photos.target, "photo") +
            " Listings with eight or more are opened far more often.",
    },
    {
      key: "description",
      name: "Description",
      score: pct(input.descriptionLength, TARGETS.description.target),
      weight: TARGETS.description.weight,
      applicable: true,
      tip:
        input.descriptionLength >= TARGETS.description.target
          ? "Your description gives a guest enough to picture the stay."
          : "Write a fuller description — a guest deciding between two hotels reads this.",
    },
    {
      key: "rooms",
      name: "Room types",
      score: pct(input.rooms, TARGETS.rooms.target),
      weight: TARGETS.rooms.weight,
      applicable: true,
      tip:
        input.rooms >= TARGETS.rooms.target
          ? `${input.rooms} room types listed.`
          : "More room types give a guest something to choose between.",
    },
    {
      key: "amenities",
      name: "Amenities",
      score: pct(input.amenities, TARGETS.amenities.target),
      weight: TARGETS.amenities.weight,
      applicable: true,
      tip:
        input.amenities >= TARGETS.amenities.target
          ? "Good coverage of what you offer."
          : "List more amenities — guests filter the search on them.",
    },
    {
      key: "extras",
      name: "Extras at checkout",
      score: pct(input.valueAdds, TARGETS.extras.target),
      weight: TARGETS.extras.weight,
      applicable: true,
      tip: input.valueAdds
        ? `${input.valueAdds} extra${input.valueAdds === 1 ? "" : "s"} offered at checkout.`
        : "Breakfast, parking, a late check-out — extras a guest can add while booking.",
    },
    {
      key: "reviews",
      name: "Guest rating",
      /*
       * Not applicable until somebody has actually reviewed the place.
       *
       * The prototype scored this `0` for a listing with no reviews, which
       * quietly told every new property its page was poor — for the one thing
       * it could do nothing about on its first day.
       */
      score: input.reviewCount > 0 ? Math.round((input.rating / 5) * 100) : null,
      weight: TARGETS.reviews.weight,
      applicable: input.reviewCount > 0,
      tip:
        input.reviewCount > 0
          ? `${input.rating.toFixed(1)} out of 5 across ${input.reviewCount} published ${
              input.reviewCount === 1 ? "review" : "reviews"
            }.`
          : "No published reviews yet — this does not count against your score.",
    },
    {
      key: "responses",
      name: "Replies to reviews",
      score:
        input.reviewCount > 0
          ? Math.round((input.reviewsReplied / input.reviewCount) * 100)
          : null,
      weight: TARGETS.responses.weight,
      applicable: input.reviewCount > 0,
      tip:
        input.reviewCount === 0
          ? "Nothing to reply to yet."
          : input.reviewsReplied >= input.reviewCount
            ? "Every published review has a reply."
            : `${input.reviewCount - input.reviewsReplied} ${
                input.reviewCount - input.reviewsReplied === 1 ? "review is" : "reviews are"
              } waiting for a reply.`,
    },
  ]

  /*
   * Weighted across the APPLICABLE categories only, so the weights are
   * renormalised rather than the total being quietly capped at 80.
   */
  const counted = categories.filter((c) => c.applicable)
  const totalWeight = counted.reduce((sum, c) => sum + c.weight, 0)
  const total =
    totalWeight > 0
      ? Math.round(counted.reduce((sum, c) => sum + (c.score ?? 0) * c.weight, 0) / totalWeight)
      : 0

  return { total, band: scoreBand(total), categories }
}
