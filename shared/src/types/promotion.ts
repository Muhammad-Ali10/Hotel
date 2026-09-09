import type { Cents, ISODate, Timestamps, UUID } from "./common"

/* ------------------------------------------------------------- discounts -- */

export type DiscountType = "percent" | "amount" | "free_night"

/**
 * A structured discount — never a display string.
 *
 * `value` means something different per type, so read it with the type:
 *  - `percent`     → 15 = 15% off the room subtotal
 *  - `amount`      → Cents off, capped at the room subtotal
 *  - `free_night`  → 3 = every 3rd night is free
 */
export type Discount = {
  type: DiscountType
  value: number
  /** The promotion that produced it, when partner-driven. */
  promotionId?: UUID
}

/* ------------------------------------------------------------ promotions -- */

/**
 * `scheduled` and `ended` come from the admin panel. The core types only had
 * `active | paused | draft`, so a promotion whose window had closed still read
 * as "active" even though `activeDiscountFor` filtered it out by date — the
 * status and the behaviour disagreed.
 */
export type PromotionStatus = "draft" | "scheduled" | "active" | "paused" | "ended"

/**
 * Which audience the promotion reaches (rule #3).
 *
 * In the prototype only `all` was ever honoured, so a live "Mobile-only Rate
 * 25%" and a live "Genius Level 2 15%" sat on The Ritz-Carlton and reached
 * nobody — the partner saw them as active while every guest paid full price.
 *
 * Both are resolved SERVER-side: channel from the request, tier from the
 * session. Never taken from the client.
 */
export type PromotionChannel = "all" | "mobile" | "genius"

/**
 * Marketing categorisation only (rule #16) — reporting groups by it.
 * `discountAmount()` never reads this.
 */
export type PromotionKind =
  | "seasonal_deal"
  | "limited_time"
  | "member_exclusive"
  | "group_booking"
  | "early_bird"
  | "last_minute"
  | "flash"

export type Promotion = Timestamps & {
  id: UUID
  name: string
  kind: PromotionKind

  discount: Discount

  startDate: ISODate
  endDate: ISODate

  /**
   * Which rooms the promotion covers. **Empty array = every room** of every
   * listed property (rule #21).
   *
   * This was free text — `"All room types"`, `"Standard rooms"` — which no code
   * could evaluate, so a "Standard rooms" promotion silently discounted suites
   * too. The label said one thing and the discount did another.
   */
  roomIds: UUID[]

  /**
   * Minimum nights for the promotion to apply — "stay 3+, save 20%" (rule #22).
   * `null` = no minimum.
   *
   * The field existed but `activeDiscountFor` never read it, so a promotion
   * literally named "Stay Longer, Save More" applied to one-night stays.
   */
  minStay: number | null

  channel: PromotionChannel
  status: PromotionStatus
}

/** Many-to-many: a promotion can cover several properties. */
export type PromotionProperty = {
  promotionId: UUID
  propertyId: UUID
}

/** Rolled up for reporting — never part of the promotion row itself. */
export type PromotionPerformance = {
  promotionId: UUID
  bookings: number
  revenue: Cents
}
