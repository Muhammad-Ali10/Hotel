import type { CancellationPolicy } from "../types/property"
import type {
  Payment,
  PaymentIntentKind,
  PaymentMode,
  PaymentStatus,
} from "../types/payment"

/* ============================================================================
 * Payment rules (rules #42–#46).
 *
 * Pure functions, no provider anywhere. Everything here answers a question the
 * business asked — "may this rate plan take money later?", "is this booking
 * paid for?" — and none of it knows what a provider call looks like.
 * ========================================================================== */

/** How long a booking may hold inventory while its payment is in flight (#44). */
export const HOLD_MINUTES = 15

/* ------------------------------------------------------------ mode rules -- */

/**
 * Whether a rate plan's payment mode is legal for its cancellation policy.
 *
 * A `non_refundable` rate on a `guarantee` mode is the contradiction worth
 * blocking: it promises the property the money whatever happens, then takes
 * nothing and leaves the platform to chase a card it only verified. The rate
 * that gives up the right to cancel is exactly the one that must be paid up
 * front.
 *
 * Enforced again as a database CHECK. This function is what tells a partner
 * WHY while they are still editing the rate plan.
 */
export function isModeAllowed(
  mode: PaymentMode,
  policy: Pick<CancellationPolicy, "freeUntil">
): boolean {
  if (policy.freeUntil === "non_refundable") return mode === "prepay"
  return true
}

/**
 * What a payment of this mode is for, and how much it moves.
 *
 * A guarantee is a zero-amount intent — the card is proved, not charged. That
 * `0` is the whole difference between the two modes at the provider, so it is
 * derived here rather than left to each caller to remember.
 *
 * `penalty` is excluded from the return type on purpose: a booking's FIRST
 * payment is never a penalty, and narrowing it here means the caller that
 * creates it does not have to handle a case that cannot occur.
 */
export function intentFor(
  mode: PaymentMode,
  bookingTotal: number
): { kind: Exclude<PaymentIntentKind, "penalty">; amount: number } {
  return mode === "prepay"
    ? { kind: "charge", amount: bookingTotal }
    : { kind: "guarantee", amount: 0 }
}

/* ---------------------------------------------------------- state machine -- */

/**
 * Which statuses may follow which.
 *
 * A payment is a record of something that happened, so this graph only ever
 * moves forward — there is no edge back to `requires_payment_method` from a
 * captured payment, because "un-capturing" is a refund and has its own row.
 */
const TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  requires_payment_method: ["requires_action", "authorized", "captured", "failed", "cancelled"],
  requires_action: ["authorized", "captured", "failed", "cancelled"],
  // A guarantee stops at `authorized` and stays there for the whole stay.
  authorized: ["captured", "cancelled", "failed"],
  captured: ["refunded", "partially_refunded"],
  partially_refunded: ["refunded", "partially_refunded"],
  // Terminal.
  refunded: [],
  failed: [],
  cancelled: [],
}

export type PaymentTransition = { ok: true } | { ok: false; reason: string }

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): PaymentTransition {
  if (from === to) return { ok: false, reason: `The payment is already ${from}.` }
  if (!TRANSITIONS[from].includes(to)) {
    return { ok: false, reason: `A ${from} payment cannot become ${to}.` }
  }
  return { ok: true }
}

/** Statuses that mean the provider has finished with this intent. */
export function isPaymentTerminal(status: PaymentStatus): boolean {
  return TRANSITIONS[status].length === 0
}

/**
 * Whether a payment has done its job well enough to confirm the booking (#44).
 *
 * `captured` for a prepay; for a guarantee, `authorized` — the card is on file
 * and usable. A guarantee that has since been captured counts too: that is a
 * no-show fee taken against the same card, which is strictly more settled than
 * an authorization, and reading it as unsettled would let a later re-check
 * un-confirm a stay that already happened.
 */
export function settles(mode: PaymentMode, status: PaymentStatus): boolean {
  if (mode === "prepay") return status === "captured"
  return status === "authorized" || status === "captured"
}

/* ---------------------------------------------------------------- refunds -- */

/**
 * How much of a payment may still be sent back.
 *
 * Guards the case that matters: two refunds racing, or a retried webhook,
 * asking for more than was ever taken. The provider would refuse it — but
 * only after we had recorded it.
 */
export function refundableAmount(
  payment: Pick<Payment, "status" | "amount" | "amountRefunded">
): number {
  if (payment.status !== "captured" && payment.status !== "partially_refunded") return 0
  return Math.max(0, payment.amount - payment.amountRefunded)
}

/** The status a payment lands on once `refunded` cents have gone back. */
export function statusAfterRefund(
  payment: Pick<Payment, "amount">,
  totalRefunded: number
): PaymentStatus {
  return totalRefunded >= payment.amount ? "refunded" : "partially_refunded"
}

/**
 * What actually has to happen to settle a cancellation.
 *
 * The two modes need OPPOSITE operations for the same policy. A prepaid
 * booking already handed the money over, so the outcome is sending part of it
 * back. A guaranteed booking handed nothing over, so the same outcome is
 * charging the saved card. Deciding it here keeps the cancellation flow from
 * having to remember which way round it is.
 *
 * Both figures come straight from `refundFor()` — rule #1 owns the arithmetic,
 * and this function does none of its own. Recomputing the penalty as
 * `total − refund` would be a second implementation of the same rule, free to
 * drift the day a policy grows a fee that is neither.
 */
export function settlementFor(input: {
  mode: PaymentMode
  /** `refundFor().refund` — what the guest gets back. */
  refund: number
  /** `refundFor().charged` — what the property keeps. */
  charged: number
}): { action: "refund" | "charge_penalty" | "none"; amount: number } {
  if (input.mode === "prepay") {
    // They paid everything; whatever is not kept as a penalty goes back.
    return input.refund > 0
      ? { action: "refund", amount: input.refund }
      : { action: "none", amount: 0 }
  }

  // They paid nothing; the penalty is the only money that ever moves.
  return input.charged > 0
    ? { action: "charge_penalty", amount: input.charged }
    : { action: "none", amount: 0 }
}
