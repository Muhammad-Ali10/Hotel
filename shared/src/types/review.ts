import type { ISODate, ISODateTime, ImageSeed, Timestamps, UUID } from "./common"

/* --------------------------------------------------------------- reviews -- */

export type ReviewCategory =
  | "cleanliness"
  | "comfort"
  | "location"
  | "facilities"
  | "staff"

export type ReviewCategories = Record<ReviewCategory, number>

export const REVIEW_CATEGORIES: { key: ReviewCategory; label: string }[] = [
  { key: "cleanliness", label: "Cleanliness" },
  { key: "comfort", label: "Comfort" },
  { key: "location", label: "Location" },
  { key: "facilities", label: "Facilities" },
  { key: "staff", label: "Staff" },
]

/**
 * Only `published` reviews are visible publicly, and only `published` reviews
 * count towards a property's rating.
 *
 * The admin panel used a different set — `Published | Flagged | Pending Review
 * | Hidden`. `Hidden` is not a distinct outcome: hiding a review IS rejecting
 * it, so these states cover the whole moderation cycle.
 *
 * `withdrawn` is the author's own decision and is kept separate from
 * `rejected` on purpose: months later, "the guest took this down" and "we took
 * this down" are different facts, and collapsing them loses the only evidence
 * of which one happened.
 */
export type ReviewStatus =
  | "published"
  | "pending"
  | "flagged"
  | "rejected"
  | "withdrawn"

export type ReviewResponse = {
  text: string
  at: ISODateTime
}

export type Review = Timestamps & {
  id: UUID
  propertyId: UUID

  /** Set when the review came from a real stay → renders the Verified badge. */
  bookingId: UUID | null
  /** The account that wrote it. `null` for imported / OTA reviews. */
  authorId: UUID | null

  /** Snapshot of the author's display name at the time of writing. */
  author: string
  authorSeed: ImageSeed
  country: string
  roomName: string

  /** 1–5. The only rating scale in the product. */
  rating: number
  categories: ReviewCategories

  title: string
  body: string
  date: ISODate

  status: ReviewStatus
  /**
   * Why a moderator flagged or rejected it. The admin panel had this and the
   * core types did not, so moderation decisions carried no reason at all.
   */
  flagReason: string | null

  response: ReviewResponse | null
}

/**
 * Always DERIVED from published reviews, never stored on the property — so no
 * two screens can disagree about a rating.
 */
export type PropertyRating = {
  rating: number
  reviewCount: number
  categories: ReviewCategories
}
