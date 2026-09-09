import type { Cents } from "../types/common"

/* ============================================================================
 * How the platform collects its commission (rules #91–#95).
 *
 * The commission is the same either way. What changes is WHEN it is taken:
 * held back from the payout, or billed at the end of the month. This is not a
 * subscription — there is no monthly fee, only the same commission, later.
 * ========================================================================== */

export const SETTLEMENT_MODES = ["deduct", "invoice"] as const
export type SettlementMode = (typeof SETTLEMENT_MODES)[number]

/**
 * Where a booking's commission goes.
 *
 * Named `Collection`, not `Settlement` — `settlementFor()` in `payments.ts`
 * already answers a different question (refund or penalty on a cancellation),
 * and two functions with one name in one barrel is how a caller reaches for
 * the wrong one.
 */
export type Collection =
  | { collect: "deducted"; payout: Cents; billed: Cents }
  | { collect: "billed"; payout: Cents; billed: Cents }

/**
 * What happens to one booking's money (rules #91–#93).
 *
 * On `deduct` the commission always comes off — even on a `guarantee` stay,
 * where this one line goes negative and the partner's prepaid bookings in the
 * same cycle cover it. Only a cycle that cannot cover itself produces an
 * invoice (rule #93), so the platform is never handing over money it is owed.
 *
 * On `invoice` nothing is held back at all: the partner receives everything
 * and is billed monthly. That is the arrangement only a platform admin may
 * grant, because it is the one where the money leaves first.
 */
export function collectionFor(input: {
  mode: SettlementMode
  paymentMode: "prepay" | "guarantee"
  /**
   * What the platform is HOLDING for this stay — captured minus refunded.
   *
   * Not the booking's total. On a `guarantee` stay it is zero: the guest paid
   * the property and nothing reached the platform. Naming it `total` once made
   * a test pass `100_000` for a guarantee booking and quietly assert the
   * opposite of the rule.
   */
  gross: Cents
  /** The platform's cut, snapshotted at booking (rule #20). */
  commission: Cents
}): Collection {
  if (input.mode === "invoice") {
    /*
     * Nothing is held back at all. The partner receives everything the
     * platform collected and is billed at the end of the month — which is why
     * only a platform admin may grant this (rule #92).
     */
    return { collect: "billed", payout: input.gross, billed: input.commission }
  }

  /*
   * `deduct` — and the commission comes off the CYCLE, not off this booking.
   *
   * On a `guarantee` stay the platform collected nothing, so this line alone
   * cannot pay it: `payout` goes negative. That is deliberate and it is the
   * point. The partner's OTHER bookings in the same period — the prepaid ones
   * — cover it, and the platform is never out of pocket.
   *
   * A first version of this sent every guarantee commission straight to the
   * monthly invoice. It read more cleanly and it was worse: a partner with
   * $800 of prepaid payouts and $300 of guarantee commission would have been
   * paid the full $800 and invoiced $300, leaving the platform exposed for
   * money it was holding a moment earlier. Only what the cycle cannot cover
   * becomes an invoice.
   */
  return {
    collect: "deducted",
    payout: input.gross - input.commission,
    billed: 0,
  }
}

/* ------------------------------------------------------------ the invoice */

export type InvoiceLine = {
  bookingId: string
  ref: string
  total: Cents
  commission: Cents
}

export type InvoiceSummary = {
  bookings: number
  /** The gross the lines were computed from — for the partner to check against. */
  gross: Cents
  /** What is actually owed. */
  amount: Cents
}

/**
 * The month's bill.
 *
 * Every line is shown, not just the total. An invoice a partner cannot check
 * against their own records is one they query rather than pay, and "you owe us
 * $2,400" with no working is the slowest possible way to be paid.
 */
export function summariseInvoice(lines: readonly InvoiceLine[]): InvoiceSummary {
  return {
    bookings: lines.length,
    gross: lines.reduce((sum, line) => sum + line.total, 0),
    amount: lines.reduce((sum, line) => sum + line.commission, 0),
  }
}

/**
 * How long a partner has to pay before rule #95 applies.
 *
 * Fourteen days: long enough for an accounts department that runs a fortnightly
 * payment cycle to catch it once, short enough that two unpaid months cannot
 * quietly accumulate.
 */
export const INVOICE_DUE_DAYS = 14

export type InvoiceState = "issued" | "paid" | "overdue" | "void"

/**
 * Whether an unpaid invoice has run out of time.
 *
 * Dates only, no clock arithmetic: an invoice is not overdue at 00:00:01 on
 * the fifteenth day because of a timezone.
 */
export function isOverdue(input: { dueDate: string; today: string; state: InvoiceState }): boolean {
  if (input.state !== "issued") return false
  return input.today > input.dueDate
}

/**
 * What an overdue invoice costs the partner (rule #95).
 *
 * The org drops back to `deduct` — new bookings start having the commission
 * held back again — and its payouts stop until the balance clears.
 *
 * The listing stays up, deliberately. A guest who booked has done nothing
 * wrong, and pulling the property punishes them rather than the partner.
 */
export type OverdueConsequence = {
  revertToDeduct: true
  holdPayouts: true
  suspendListings: false
}

export const OVERDUE_CONSEQUENCE: OverdueConsequence = {
  revertToDeduct: true,
  holdPayouts: true,
  suspendListings: false,
}
