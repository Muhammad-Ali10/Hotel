import type { Cents, ISODateTime, Timestamps, UUID } from "./common"

/* --------------------------------------------------------------- payments -- */

/**
 * How a rate plan takes money (rule #42).
 *
 * `prepay`    — the full amount is captured when the booking is confirmed.
 * `guarantee` — the card is verified and saved, and nothing is captured. The
 *               guest settles the room at the property; the platform charges
 *               that saved card for cancellation penalties and no-shows.
 *
 * The prototype had `"card" | "property"`, which read as the same choice but
 * was not: `property` meant no card at all. That left rule #1's cancellation
 * charges and rule #9's no-show with nothing to charge, and made an empty
 * hotel free to arrange. Both modes here hold a card; only the timing differs.
 */
export const PAYMENT_MODES = ["prepay", "guarantee"] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

/**
 * Where a payment has got to.
 *
 * `requires_action` is the 3-D Secure / redirect step, and it is a settled
 * state rather than a passing one: the guest has left for their bank and may
 * come back in ten seconds, in ten minutes, or never. A booking sitting here
 * is exactly what the 15-minute hold (rule #44) exists to time out.
 */
export const PAYMENT_STATUSES = [
  "requires_payment_method",
  "requires_action",
  "authorized",
  "captured",
  "failed",
  "cancelled",
  "refunded",
  "partially_refunded",
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** What a payment row is FOR. */
export const PAYMENT_INTENT_KINDS = [
  /** Take the room total now (a `prepay` rate plan). */
  "charge",
  /** Verify and store a card without taking the room total (a `guarantee`). */
  "guarantee",
  /** Charge a saved card later — a cancellation penalty or a no-show fee. */
  "penalty",
] as const
export type PaymentIntentKind = (typeof PAYMENT_INTENT_KINDS)[number]

/**
 * One attempt to move money, or to prove that money could be moved.
 *
 * A booking has many of these over its life: the original charge, a penalty
 * when the guest cancels late, a refund against either. They are never
 * overwritten — a payment row is a record of something that happened, and
 * editing history is how a refund gets paid twice.
 */
export type Payment = Timestamps & {
  id: UUID
  bookingId: UUID
  kind: PaymentIntentKind
  status: PaymentStatus

  /** Cents. `0` for a guarantee — the card is verified, not charged. */
  amount: Cents
  amountRefunded: Cents
  /** Rule #12: USD only in v1. Stored anyway, because adding it later is worse. */
  currency: string

  /** Enough to recognise a card on a screen, useless to anyone who steals it. */
  cardBrand: string | null
  cardLast4: string | null

  failureReason: string | null
  capturedAt: ISODateTime | null
}
