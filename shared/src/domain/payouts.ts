import type { Cents, ISODate } from "../types/common"
import { addDays, daysBetween } from "./dates"
import { collectionFor } from "./settlement-mode"

/* ============================================================================
 * Payouts (rules #48–#52).
 *
 * The platform is merchant of record, so guest money lands here first and has
 * to be sent on. What makes this less obvious than it sounds is that the two
 * payment modes push money in OPPOSITE directions, and a single property can
 * sell both on the same day.
 * ========================================================================== */

/** Below this, the transfer fee eats the transfer. Carried, never dropped. */
export const PAYOUT_MINIMUM: Cents = 10_000

/** Days after checkout before a stay is payable (rule #49). */
export const PAYOUT_HOLD_DAYS = 7

/* ----------------------------------------------------------------- periods */

export type PayoutPeriod = {
  /** Inclusive. */
  start: ISODate
  /** Inclusive. */
  end: ISODate
  /** The day the run happens — the day AFTER the period closes. */
  runsOn: ISODate
}

/**
 * The fortnightly cycle: the 1st and the 16th (rule #48).
 *
 * Calendar halves rather than "every 14 days" on purpose. A rolling fortnight
 * drifts through the month, so a property's payout date moves every cycle and
 * their accounting never lines up with anything. The 1st and the 16th are the
 * same two dates forever, and the second half absorbs the difference between a
 * 28-day February and a 31-day March.
 */
export function periodFor(date: ISODate): PayoutPeriod {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number]
  const yyyy = String(year).padStart(4, "0")
  const mm = String(month).padStart(2, "0")

  if (day <= 15) {
    return {
      start: `${yyyy}-${mm}-01` as ISODate,
      end: `${yyyy}-${mm}-15` as ISODate,
      /** The run happens on the 16th, once the first half has closed. */
      runsOn: `${yyyy}-${mm}-16` as ISODate,
    }
  }

  const start = `${yyyy}-${mm}-16` as ISODate
  // The last day of this month, found by stepping back from the 1st of the next.
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${yyyy}-${String(month + 1).padStart(2, "0")}-01`
  return {
    start,
    end: addDays(nextMonth as ISODate, -1),
    runsOn: nextMonth as ISODate,
  }
}

/** The period that just closed, as of `today` — the one a run pays out. */
export function periodToPayOn(today: ISODate): PayoutPeriod {
  return periodFor(addDays(today, -1))
}

/* ---------------------------------------------------------------- payable */

/**
 * Whether a booking's money may leave yet (rule #49).
 *
 * Two separate questions, and `isPayable` in `./commission` only answers one of
 * them: whether the platform EARNED its commission. This answers whether the
 * money may move, which is not the same thing.
 *
 * Note what is included: a `void` commission still enters a run. A booking
 * cancelled late has no commission — but the platform may be holding a
 * cancellation penalty it collected on the property's behalf, and that is the
 * property's money. Filtering on `earned` alone would keep it forever.
 *
 * The seven days are about the guest, not the property: a dispute raised the
 * week after checkout is ordinary, and money already wired out is money nobody
 * gets back.
 */
export function isReleasable(
  booking: { commissionStatus: string; checkOut: ISODate },
  today: ISODate
): boolean {
  // Still in progress — the stay's outcome is not known yet.
  if (booking.commissionStatus === "pending") return false
  return daysBetween(booking.checkOut, today) >= PAYOUT_HOLD_DAYS
}

/* ------------------------------------------------------------------ lines */

export type PayoutLine = {
  bookingId: string
  /**
   * What the platform actually COLLECTED and still holds for this booking.
   *
   * From the payments ledger — captured minus refunded — never from the
   * booking's total. They differ constantly: a partial refund, a penalty
   * charged instead of a room rate, a guarantee that collected nothing at all.
   * The ledger is what the bank agrees with.
   */
  gross: Cents
  /**
   * What was DEDUCTED from this payout.
   *
   * `0` when the commission was voided (a stay that did not happen), and also
   * `0` whenever it is being billed instead — on a `guarantee` booking, or for
   * an org on `invoice` (rules #91–#93).
   */
  commission: Cents
  /**
   * What goes on the month's commission invoice instead (rules #91, #94).
   *
   * The other half of `commission`: between them they always account for the
   * whole earned commission, and never both at once.
   */
  billed: Cents
  /**
   * What the property is owed. NEGATIVE means the property owes us.
   *
   * Still negative on a guaranteed stay under `deduct` (rule #52) — the
   * partner's prepaid bookings in the same cycle absorb it. What changed is
   * only what happens when the WHOLE cycle cannot: that shortfall now becomes
   * a monthly commission invoice with a period and a due date, rather than a
   * payout run reporting a negative number (rules #91–#94).
   */
  net: Cents
}

export function lineFor(input: {
  bookingId: string
  captured: Cents
  refunded: Cents
  commissionAmount: Cents
  commissionStatus: string
  /** From the rate plan — who received the guest's money (rule #42). */
  paymentMode: "prepay" | "guarantee"
  /** From the org — how the platform collects (rule #91). */
  settlementMode: "deduct" | "invoice"
}): PayoutLine {
  const gross = Math.max(0, input.captured - input.refunded)
  const earned = input.commissionStatus === "earned" ? input.commissionAmount : 0

  /*
   * Deducted, or billed (rules #91–#93).
   *
   * On `deduct` the commission comes off, and a `guarantee` line goes NEGATIVE
   * — rule #52, unchanged. The partner's prepaid bookings in the same cycle
   * cover it, and only a cycle that cannot cover itself becomes an invoice.
   *
   * On `invoice` nothing comes off: the partner is paid in full and billed at
   * the end of the month.
   */
  const collection = collectionFor({
    mode: input.settlementMode,
    paymentMode: input.paymentMode,
    gross,
    commission: earned,
  })

  const commission = collection.collect === "deducted" ? earned : 0

  return {
    bookingId: input.bookingId,
    gross,
    commission,
    /** Goes on the month's invoice instead of coming off this payout. */
    billed: collection.collect === "billed" ? earned : 0,
    net: gross - commission,
  }
}

/* --------------------------------------------------------------- the run */

export type PayoutDirection = "payout" | "invoice" | "carry" | "none"

export type PayoutSummary = {
  gross: Cents
  commission: Cents
  /** Signed: positive is owed to the property, negative is owed to us. */
  net: Cents
  direction: PayoutDirection
  bookingCount: number
}

/**
 * What a period comes to, and which way the money goes.
 *
 *  `payout`  — we owe them, and it clears the minimum
 *  `carry`   — we owe them, but not enough to be worth a transfer fee (#50)
 *  `invoice` — they owe us, because their guests paid them directly (#52)
 *  `none`    — nothing happened
 *
 * `carryIn` is last cycle's carried balance. Without it a property earning $60
 * a fortnight would carry forever and never be paid — the balance has to
 * accumulate, not reset.
 */
export function summarise(lines: readonly PayoutLine[], carryIn: Cents = 0): PayoutSummary {
  const gross = lines.reduce((sum, l) => sum + l.gross, 0)
  const commission = lines.reduce((sum, l) => sum + l.commission, 0)
  const net = lines.reduce((sum, l) => sum + l.net, 0) + carryIn

  const direction: PayoutDirection =
    net < 0 ? "invoice" : net === 0 ? "none" : net >= PAYOUT_MINIMUM ? "payout" : "carry"

  return { gross, commission, net, direction, bookingCount: lines.length }
}

/** Whether a balance is worth the transfer fee (rule #50). */
export function meetsMinimum(net: Cents): boolean {
  return net >= PAYOUT_MINIMUM
}
