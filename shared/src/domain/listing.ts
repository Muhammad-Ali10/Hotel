/* ============================================================================
 * When a listing may go live, and what a change costs (rules #70–#73).
 *
 * Both questions are pure: given a listing's shape, is it complete enough to
 * submit; given a before and an after, does the difference need a human. Kept
 * out of the service so the extranet can answer the first one WITHOUT calling
 * the API — a partner should see "3 more photos" while they are still on the
 * page, not after a round trip that rejects them.
 * ========================================================================== */

/** Rule #70 — the bar for submitting a listing to review. */
export const PUBLISH_MINIMUM = {
  rooms: 1,
  ratePlans: 1,
  photos: 5,
  descriptionChars: 120,
} as const

/** Rule #73 — what an upload may be. */
export const PHOTO_LIMITS = {
  min: PUBLISH_MINIMUM.photos,
  max: 50,
  maxBytes: 5 * 1024 * 1024,
  contentTypes: ["image/jpeg", "image/png", "image/webp"],
} as const

export type PublishGap =
  | { code: "rooms"; need: number; have: number }
  | { code: "rate_plans"; need: number; have: number }
  | { code: "photos"; need: number; have: number }
  | { code: "description"; need: number; have: number }

/**
 * What is still missing before this listing can be submitted (rule #70).
 *
 * Returns every gap, not the first one. A partner told "you need photos", who
 * then adds photos and is told "you need a rate plan", learns that the system
 * will keep finding new reasons — and that is how a half-finished listing gets
 * abandoned.
 */
export function publishGaps(listing: {
  rooms: number
  ratePlans: number
  /** Only photos that count — see `PHOTO_LIMITS`; rejected ones do not. */
  photos: number
  description: string
}): PublishGap[] {
  const gaps: PublishGap[] = []

  if (listing.rooms < PUBLISH_MINIMUM.rooms) {
    gaps.push({ code: "rooms", need: PUBLISH_MINIMUM.rooms, have: listing.rooms })
  }
  if (listing.ratePlans < PUBLISH_MINIMUM.ratePlans) {
    gaps.push({ code: "rate_plans", need: PUBLISH_MINIMUM.ratePlans, have: listing.ratePlans })
  }
  if (listing.photos < PUBLISH_MINIMUM.photos) {
    gaps.push({ code: "photos", need: PUBLISH_MINIMUM.photos, have: listing.photos })
  }

  const described = listing.description.trim().length
  if (described < PUBLISH_MINIMUM.descriptionChars) {
    gaps.push({
      code: "description",
      need: PUBLISH_MINIMUM.descriptionChars,
      have: described,
    })
  }

  return gaps
}

export function isPublishable(listing: Parameters<typeof publishGaps>[0]): boolean {
  return publishGaps(listing).length === 0
}

/* --------------------------------------------------------- material change */

/**
 * The fields a guest decides on, which is why changing one needs review
 * (rule #71).
 *
 * Everything absent from this list — rates, availability, a room's name, the
 * cancellation terms — takes effect immediately. Those are the levers a
 * property pulls daily, and putting a human in front of them would mean a
 * hotel could not reprice a Friday night without waiting for an approval.
 *
 * `photos` is not here because it is not a column; a photo has its own
 * `pending` state and the same rule reaches it that way.
 */
export const MATERIAL_FIELDS = ["name", "city", "country", "address", "stars", "type"] as const

export type MaterialField = (typeof MATERIAL_FIELDS)[number]

/**
 * Which material fields a patch actually changes.
 *
 * Compares VALUES, not keys. A form that re-submits every field on every save
 * would otherwise send a listing back to review for a change nobody made —
 * and after that happens twice, partners stop editing their listings at all.
 */
export function materialChanges(
  current: Partial<Record<MaterialField, unknown>>,
  patch: Partial<Record<string, unknown>>
): MaterialField[] {
  return MATERIAL_FIELDS.filter(
    (field) => field in patch && !sameValue(current[field], patch[field])
  )
}

/**
 * Whether a listing already live needs a human to look at this change.
 *
 * A `draft` never does: nothing is published yet, so there is nothing to
 * protect, and asking for approval of an unpublished edit is pure friction.
 */
export function needsReview(input: {
  status: string
  current: Partial<Record<MaterialField, unknown>>
  patch: Partial<Record<string, unknown>>
}): boolean {
  if (input.status === "draft" || input.status === "changes_requested") return false
  return materialChanges(input.current, input.patch).length > 0
}

/* ------------------------------------------------------------------ photos */

export type PhotoRejection = "type" | "too_large" | "too_many"

/**
 * Whether an upload may be accepted, checked BEFORE a URL is handed out.
 *
 * The size and type come from the client and cannot be trusted on their own —
 * they are what the presigned URL is then locked to, so a client that lies
 * here gets a URL that storage itself refuses.
 */
export function photoRejection(input: {
  contentType: string
  bytes: number
  existing: number
}): PhotoRejection | null {
  if (!(PHOTO_LIMITS.contentTypes as readonly string[]).includes(input.contentType)) {
    return "type"
  }
  if (input.bytes <= 0 || input.bytes > PHOTO_LIMITS.maxBytes) return "too_large"
  if (input.existing >= PHOTO_LIMITS.max) return "too_many"
  return null
}

/* ------------------------------------------------------------------ local */

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // A form sends "" where the database holds null; that is not a change.
  if ((a ?? "") === (b ?? "")) return true
  return false
}
