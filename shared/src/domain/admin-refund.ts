import type { Cents } from "../types/common"

/* ============================================================================
 * What a platform refund costs, and who pays for it (rules #76, #78).
 *
 * `refundFor()` answers what a guest is OWED under the terms they agreed to.
 * This answers a different question: what happens when the platform decides to
 * give back MORE than that, because a guest complained and somebody senior
 * agreed with them.
 *
 * The two must not be the same function. Mixing them would let a goodwill
 * decision quietly rewrite the cancellation policy the property published.
 * ========================================================================== */

export type AdminRefundInput = {
  /** What the guest actually paid, from the payments ledger — not the total. */
  captured: Cents
  /** What has already gone back on this booking. */
  alreadyRefunded: Cents
  /** What the terms say the guest is owed (`refundFor().refund`). */
  entitled: Cents
  /** What the platform's cut was, snapshotted at booking (rule #20). */
  commission: Cents
  /** What the admin wants to send back, in cents. */
  amount: Cents
}

export type AdminRefundRejection =
  | "nothing_captured"
  | "not_positive"
  | "exceeds_captured"

export type AdminRefundPlan = {
  /** What actually moves back to the guest. */
  refund: Cents
  /** Beyond the terms — the goodwill part (rule #76). */
  goodwill: Cents
  /**
   * Whether the platform gives up its commission (rule #76).
   *
   * True whenever ANY part of this refund is goodwill. The platform made the
   * call, so the platform carries it — a property must not lose money on a
   * decision it was not part of and is not told about.
   */
  voidsCommission: boolean
  /** What the platform gives up, in cents. Zero when nothing is goodwill. */
  commissionGivenUp: Cents
  /** Everything back, so the booking's refund status can say `full`. */
  isFull: boolean
}

/**
 * Whether this refund may happen at all.
 *
 * `captured` is the ceiling, never `bookings.total`. On a `guarantee` rate the
 * guest may have paid the platform nothing at all, and refunding against the
 * total would send out money that never came in.
 */
export function adminRefundRejection(input: AdminRefundInput): AdminRefundRejection | null {
  const refundable = input.captured - input.alreadyRefunded
  if (refundable <= 0) return "nothing_captured"
  if (input.amount <= 0) return "not_positive"
  if (input.amount > refundable) return "exceeds_captured"
  return null
}

/**
 * What this refund does to the money (rule #76).
 *
 * The goodwill part is whatever exceeds what the guest was already owed. Note
 * it is measured against `entitled` MINUS what has already gone back: a second
 * refund on a booking that has already paid out its entitlement is goodwill in
 * full, and treating it as a fresh entitlement would let the same allowance be
 * spent twice.
 */
export function planAdminRefund(input: AdminRefundInput): AdminRefundPlan {
  const remainingEntitlement = Math.max(0, input.entitled - input.alreadyRefunded)
  const goodwill = Math.max(0, input.amount - remainingEntitlement)

  return {
    refund: input.amount,
    goodwill,
    voidsCommission: goodwill > 0,
    commissionGivenUp: goodwill > 0 ? input.commission : 0,
    isFull: input.amount + input.alreadyRefunded >= input.captured,
  }
}

/**
 * The refund status a booking should carry afterwards.
 *
 * `processed` is deliberately absent: that is the payment provider's word, and
 * it arrives later on a webhook. Saying it here would be this API guessing at
 * something it has not been told (rule #45).
 */
export function refundStatusAfter(plan: AdminRefundPlan): "full" | "partial" {
  return plan.isFull ? "full" : "partial"
}
