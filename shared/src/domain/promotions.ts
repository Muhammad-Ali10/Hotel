import type { Cents, ISODate, UUID } from "../types/common"
import type {
  Discount,
  Promotion,
  PromotionChannel,
  PromotionStatus,
} from "../types/promotion"
import type { ResolvedNight } from "../types/property"
import type { UserTier } from "../types/user"
import { discountAmount } from "./pricing"

/* ============================================================================
 * Which promotion a guest actually gets.
 *
 * In the prototype `activeDiscountFor` filtered on `channel === "all"` and
 * ranked candidates with `percent → value × 10, amount → value`. Two things
 * followed from that:
 *
 *   - The Ritz-Carlton carried a live "Mobile-only Rate 25%" and a live
 *     "Genius Level 2 15%". Both showed as active in the partner's extranet.
 *     Neither ever reached a single guest.
 *   - A 5% offer and a $50 offer scored identically (50), whether the stay was
 *     worth $200 or $5,000.
 *
 * Both are fixed here: channels are honoured (rule #3) and the winner is the
 * one that actually saves the most money on THIS stay (rule #4).
 * ========================================================================== */

/** A promotion together with the properties it covers (the join table rows). */
export type ScopedPromotion = Promotion & {
  propertyIds: UUID[]
}

/**
 * Who is asking, resolved SERVER-side.
 *
 * Never taken from the request body: a client that could claim
 * `{ tier: "genius" }` could mint itself any discount the platform offers.
 * `isMobile` comes from the user agent / client hints, `tier` from the session.
 */
export type GuestContext = {
  isMobile: boolean
  /** `null` when the guest is not signed in. */
  tier: UserTier | null
}

export type PromotionQuery = {
  propertyId: UUID
  roomId: UUID
  /** Nights in the stay — for the promotion's own minimum (rule #22). */
  nights: number
  today: ISODate
  guest: GuestContext
}

/* --------------------------------------------------------------- filters -- */

export function channelMatches(channel: PromotionChannel, guest: GuestContext): boolean {
  switch (channel) {
    case "all":
      return true
    case "mobile":
      return guest.isMobile
    case "genius":
      return guest.tier === "genius"
  }
}

/**
 * Every condition a promotion has to satisfy before it can be offered.
 *
 * `status` must be exactly `active`. `scheduled` means "not live yet" and
 * `ended` means "finished" — a scheduled promotion whose window has opened is
 * moved to `active` by a job, not inferred here, so that what a partner sees
 * on the screen is what a guest can actually receive.
 */
export function isApplicable(promotion: ScopedPromotion, query: PromotionQuery): boolean {
  if (promotion.status !== "active") return false

  // Inclusive window, compared as yyyy-mm-dd strings — lexicographic order is
  // chronological order for this format.
  if (query.today < promotion.startDate || query.today > promotion.endDate) return false

  if (!promotion.propertyIds.includes(query.propertyId)) return false

  // Empty roomIds = every room of every listed property (rule #21).
  if (promotion.roomIds.length > 0 && !promotion.roomIds.includes(query.roomId)) return false

  if (promotion.minStay !== null && query.nights < promotion.minStay) return false

  return channelMatches(promotion.channel, query.guest)
}

export function applicablePromotions(
  promotions: readonly ScopedPromotion[],
  query: PromotionQuery
): ScopedPromotion[] {
  return promotions.filter((p) => isApplicable(p, query))
}

/* ---------------------------------------------------------------- winner -- */

export type PromotionOffer = {
  promotion: ScopedPromotion
  /** Carries `promotionId`, so the booking records which offer was applied. */
  discount: Discount
  /** What this offer actually saves on this stay. */
  saving: Cents
}

/**
 * The single best offer for a stay. Promotions never stack (rule #4).
 *
 * Every candidate is priced against the real nights and the real subtotal, and
 * the largest saving wins — so a $50 offer beats 5% on a $200 stay and loses
 * to it on a $5,000 one, which a fixed score can never express.
 *
 * Ties go to the `percent` offer: it scales with the stay, so it is the better
 * one to have advertised if either could have been shown.
 */
export function bestPromotion(
  promotions: readonly ScopedPromotion[],
  query: PromotionQuery,
  stay: { roomSubtotal: Cents; nights: readonly ResolvedNight[] }
): PromotionOffer | null {
  const offers: PromotionOffer[] = []

  for (const promotion of applicablePromotions(promotions, query)) {
    const discount: Discount = { ...promotion.discount, promotionId: promotion.id }
    const saving = discountAmount(discount, stay)
    if (saving > 0) offers.push({ promotion, discount, saving })
  }

  if (offers.length === 0) return null

  return offers.reduce((best, candidate) => {
    if (candidate.saving !== best.saving) return candidate.saving > best.saving ? candidate : best
    // Equal saving — prefer the one that grows with a longer stay.
    const candidateIsPercent = candidate.discount.type === "percent"
    const bestIsPercent = best.discount.type === "percent"
    if (candidateIsPercent !== bestIsPercent) return candidateIsPercent ? candidate : best
    // Still tied — keep the first, so the result is stable for a given input.
    return best
  })
}

/**
 * The discount a property should ADVERTISE on a listing card, where no dates
 * and no room are known yet.
 *
 * Deliberately narrower than `bestPromotion`: with no stay to price, "saves the
 * most" is unanswerable. This picks the promotion a guest is most likely to be
 * able to use — window-open, channel-matching, covering the whole property and
 * carrying no minimum stay — and returns nothing when every live offer has
 * strings attached, rather than advertising a deal the guest may not qualify
 * for once they pick their dates.
 */
export function advertisableDiscount(
  promotions: readonly ScopedPromotion[],
  input: { propertyId: UUID; today: ISODate; guest: GuestContext }
): Discount | null {
  const candidates = promotions.filter(
    (p) =>
      p.status === "active" &&
      input.today >= p.startDate &&
      input.today <= p.endDate &&
      p.propertyIds.includes(input.propertyId) &&
      p.roomIds.length === 0 &&
      p.minStay === null &&
      channelMatches(p.channel, input.guest)
  )
  if (candidates.length === 0) return null

  // Without a stay to price, rank by headline strength: a percentage is the
  // only type whose value is comparable across stays.
  const winner = candidates.reduce((best, c) =>
    headlineRank(c.discount) > headlineRank(best.discount) ? c : best
  )
  return { ...winner.discount, promotionId: winner.id }
}

function headlineRank(discount: Discount): number {
  // Percent offers rank above the others because they are the only ones whose
  // nightly display price is honest without knowing the stay length.
  return discount.type === "percent" ? 1_000_000 + discount.value : discount.value
}

/* -------------------------------------------------------------- lifecycle */

/**
 * The status a promotion SHOULD be in, given the date.
 *
 * `isApplicable` insists on exactly `active` and refuses to infer it from the
 * window — so something has to actually move promotions through their states,
 * and this is the rule that job runs on. Without it a `scheduled` promotion
 * whose window opened this morning is simply never offered to anyone.
 *
 * Two states are deliberately left alone:
 *
 *  - `draft` is unfinished work. A window opening does not mean a partner
 *    finished writing it, and publishing it for them would be the one mistake
 *    they cannot undo — the guests have already seen the price.
 *  - `paused` is a human decision. Only a human reverses it. (A pause does not
 *    reach back into a quote already signed — rule #36.)
 */
export function nextStatusFor(
  promotion: Pick<Promotion, "status" | "startDate" | "endDate">,
  today: ISODate
): PromotionStatus | null {
  if (promotion.status === "draft" || promotion.status === "paused") return null

  // Ending wins over starting: a window entirely in the past is over, however
  // long the job was down for.
  if (promotion.status !== "ended" && today > promotion.endDate) return "ended"

  if (promotion.status === "scheduled" && today >= promotion.startDate) return "active"

  // An `active` promotion whose window has not opened yet was published early
  // and by hand. Left as it is: pricing already refuses it on the date check.
  return null
}
