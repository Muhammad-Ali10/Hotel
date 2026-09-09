import type { Cents, ISODate, ISODateTime, TimeOfDay, TimeZone } from "../types/common"
import type { BookingPricing, RefundStatus } from "../types/booking"
import type { CancelCharge, CancelFreeUntil, CancellationPolicy } from "../types/property"
import { addDays, toISODateTime, zonedWallClockToInstant } from "./dates"
import { clampNonNegative, percentOf } from "./money"

/* ============================================================================
 * Cancellation — one source for the deadline, the refund AND the sentence the
 * guest reads (rule #1).
 *
 * The prototype held this in three places that could disagree: the join wizard
 * collected structured terms and discarded them, the property carried an
 * editable sentence shown at checkout, and `refundFor()` enforced a hardcoded
 * 48h/50% nobody could change. Edit the sentence and the refund did not move.
 *
 * Here the sentence is GENERATED from the same fields the refund is computed
 * from, so display and enforcement cannot drift apart.
 * ========================================================================== */

/* -------------------------------------------------------------- deadline -- */

/** How many calendar days before check-in the free window closes. */
const DAYS_BEFORE: Record<Exclude<CancelFreeUntil, "6pm_arrival" | "non_refundable">, number> = {
  "24h": 1,
  "48h": 2,
  "7d": 7,
  "14d": 14,
}

/**
 * The instant the free-cancellation window closes. `null` = never free.
 *
 * Measured in CALENDAR DAYS at the property's check-in time, not in raw hours,
 * because that is what the policy promises: "a 48-hour deadline for a 15:00
 * check-in in Tokyo expires at 15:00 Tokyo time two days before". Subtracting
 * 48×3600s would land an hour off across a daylight-saving boundary and quietly
 * change who gets a refund.
 */
export function cancellationDeadline(input: {
  policy: CancellationPolicy
  checkIn: ISODate
  checkInTime: TimeOfDay
  timezone: TimeZone
}): Date | null {
  const { policy, checkIn, checkInTime, timezone } = input

  if (policy.freeUntil === "non_refundable") return null

  if (policy.freeUntil === "6pm_arrival") {
    return zonedWallClockToInstant(checkIn, "18:00", timezone)
  }

  const days = DAYS_BEFORE[policy.freeUntil]
  return zonedWallClockToInstant(addDays(checkIn, -days), checkInTime, timezone)
}

/* ---------------------------------------------------------------- refund -- */

/** Who called the booking off. Drives rule #37. */
export type CancelledBy = "guest" | "property" | "admin"

export type RefundBreakdown = {
  /** What goes back to the guest. */
  refund: Cents
  /** What the property keeps. */
  charged: Cents
  refundStatus: Extract<RefundStatus, "full" | "partial" | "none">
  /** True when the guest cancelled before the deadline. */
  withinFreeWindow: boolean
  /** `null` for a non-refundable rate. */
  deadline: ISODateTime | null
}

/**
 * What a cancellation returns.
 *
 * The penalty applies to the ROOM ONLY (rule #18) — extras are handed back in
 * full, because a spa treatment the guest never received is not the property's
 * to keep.
 *
 * ⚠️ RULE INTERACTION, resolved deliberately: rule #1 says a `non_refundable`
 * rate refunds nothing, while rule #18 says add-ons are always refunded. They
 * collide on a non-refundable booking with extras. Rule #18 wins here, and
 * "non-refundable" is treated as a statement about the ROOM RATE — which is
 * what it means everywhere in the industry. The guest loses the room, not the
 * airport transfer.
 *
 * `cancelledAt` is passed in, never read from the clock: the domain stays pure
 * and a test can cancel at any instant it likes.
 */
export function refundFor(input: {
  policy: CancellationPolicy
  pricing: Pick<BookingPricing, "roomSubtotal" | "addOnsTotal" | "discount" | "nightlyRates" | "total">
  checkIn: ISODate
  checkInTime: TimeOfDay
  timezone: TimeZone
  cancelledAt: Date
  /** Defaults to the guest — the only party a penalty can fairly apply to. */
  by?: CancelledBy
  /**
   * The guest never arrived and never said so (rule #47).
   *
   * Not the same event as a late cancellation, and priced by its own terms
   * when the rate plan sets them. There is no free window to fall inside: the
   * deadline passed while nobody was told anything.
   */
  noShow?: boolean
}): RefundBreakdown {
  const { policy, pricing, cancelledAt } = input

  const deadline = cancellationDeadline(input)

  /**
   * A cancellation the guest did not cause carries no penalty (rule #37).
   *
   * A property closing for a renovation, or an admin unwinding a mistake, is
   * not something the guest can be charged for — not even on a non-refundable
   * rate, where the whole point of the discount was the guest accepting the
   * risk of THEIR plans changing, not the property's.
   */
  const blameless = (input.by ?? "guest") !== "guest"

  const withinFreeWindow =
    blameless ||
    // A no-show has no free window. The guest did not cancel early; they did
    // not cancel at all.
    (!input.noShow && deadline !== null && cancelledAt.getTime() <= deadline.getTime())

  // What the guest actually paid for the room, after any discount.
  const roomPaid = clampNonNegative(
    pricing.roomSubtotal - Math.abs(pricing.discount?.amount ?? 0)
  )

  const charged = withinFreeWindow
    ? 0
    : chargeForRoom(policy, roomPaid, pricing.nightlyRates, input.noShow === true)
  const refund = clampNonNegative(pricing.total - charged)

  return {
    refund,
    charged,
    refundStatus: statusFor(refund, pricing.total),
    withinFreeWindow,
    deadline: deadline ? toISODateTime(deadline) : null,
  }
}

function chargeForRoom(
  policy: CancellationPolicy,
  roomPaid: Cents,
  nightlyRates: readonly Cents[],
  noShow: boolean
): Cents {
  // A non-refundable rate keeps the whole room regardless of the charge field —
  // there is no free window for it to fall outside of.
  if (policy.freeUntil === "non_refundable") return roomPaid

  const { charge, chargeValue } = termsFor(policy, noShow)

  switch (charge) {
    case "first_night": {
      // The REAL first night, not the stay average — with per-date rates a
      // peak arrival and a shoulder arrival are not the same money.
      const firstNight = nightlyRates[0] ?? 0
      return Math.min(firstNight, roomPaid)
    }
    case "percent":
      return percentOf(roomPaid, chargeValue ?? 0)
    case "full":
      return roomPaid
  }
}

/**
 * Which of the rate plan's two charges applies (rule #47).
 *
 * A rate plan that says nothing about no-shows falls back to its cancellation
 * terms — the behaviour before these fields existed, and the one no property
 * has to opt out of. Setting them is how a property writes down "free
 * cancellation until 48 hours, but a no-show is charged in full", which is an
 * ordinary policy and was previously impossible to express at all.
 */
export function termsFor(
  policy: CancellationPolicy,
  noShow: boolean
): { charge: CancelCharge; chargeValue: number | null } {
  if (noShow && policy.noShowCharge) {
    return { charge: policy.noShowCharge, chargeValue: policy.noShowChargeValue ?? null }
  }
  return { charge: policy.charge, chargeValue: policy.chargeValue }
}

function statusFor(refund: Cents, total: Cents): RefundBreakdown["refundStatus"] {
  if (refund <= 0) return "none"
  if (refund >= total) return "full"
  return "partial"
}

/* ------------------------------------------------------------------ text -- */

export function freeUntilLabel(freeUntil: CancelFreeUntil): string {
  switch (freeUntil) {
    case "6pm_arrival":
      return "6pm on the day of arrival"
    case "24h":
      return "24 hours before check-in"
    case "48h":
      return "48 hours before check-in"
    case "7d":
      return "7 days before check-in"
    case "14d":
      return "14 days before check-in"
    case "non_refundable":
      return "never — this rate is non-refundable"
  }
}

export function chargeLabel(policy: CancellationPolicy, noShow = false): string {
  const { charge, chargeValue } = termsFor(policy, noShow)

  switch (charge) {
    case "first_night":
      return "the first night is charged"
    case "percent":
      return `${chargeValue ?? 0}% of the room rate is charged`
    case "full":
      return "the full stay is charged"
  }
}

/**
 * The no-show sentence, when the rate plan sets its own terms (rule #47).
 *
 * `null` when it does not — there is nothing extra to say, because a no-show
 * then costs exactly what the cancellation clause already told the guest.
 *
 * This sentence is the entire justification for letting a property be stricter
 * about no-shows than about cancellations: the guest reads it BEFORE booking.
 * A stricter charge that only appears afterwards is a different thing
 * altogether.
 */
export function noShowText(policy: CancellationPolicy): string | null {
  if (policy.freeUntil === "non_refundable" || !policy.noShowCharge) return null
  return `If you do not arrive and have not cancelled, ${chargeLabel(policy, true)}.`
}

/**
 * The sentence shown at checkout, on the booking, and on the property page.
 *
 * GENERATED, never stored. This is the whole point of rule #1: an editable
 * paragraph could say one thing while `refundFor` did another, and for every
 * property in the prototype it eventually would have.
 */
export function policyText(policy: CancellationPolicy): string {
  if (policy.freeUntil === "non_refundable") {
    return "This rate is non-refundable. Extras you booked are still refunded in full if you cancel."
  }
  const noShow = noShowText(policy)
  return [
    `Free cancellation until ${freeUntilLabel(policy.freeUntil)}.`,
    `After that, ${chargeLabel(policy)}.`,
    ...(noShow ? [noShow] : []),
    "Extras are always refunded in full.",
  ].join(" ")
}

/** True when the policy is internally consistent. Guards data at the edges. */
export function isValidPolicy(policy: CancellationPolicy): boolean {
  return (
    pairIsValid(policy.charge, policy.chargeValue) &&
    // A no-show clause is optional; when present it has to hold together too,
    // or a `percent` with no number silently charges nothing.
    (policy.noShowCharge == null
      ? policy.noShowChargeValue == null
      : pairIsValid(policy.noShowCharge, policy.noShowChargeValue ?? null))
  )
}

/**
 * Builds a policy from the columns a rate plan or a booking stores.
 *
 * One place, used by every caller, because these fields are OPTIONAL on the
 * type — which means a caller that forgets the no-show pair compiles perfectly
 * and silently prints the wrong terms to a guest. That happened once already,
 * on the property page, and nothing flagged it. Requiring the whole row here
 * turns the next missing column into a compile error.
 */
export function policyFromColumns(row: {
  cancelFreeUntil: string
  cancelCharge: string
  cancelChargeValue: number | null
  noShowCharge: string | null
  noShowChargeValue: number | null
}): CancellationPolicy {
  return {
    freeUntil: row.cancelFreeUntil as CancelFreeUntil,
    charge: row.cancelCharge as CancelCharge,
    chargeValue: row.cancelChargeValue,
    noShowCharge: row.noShowCharge as CancelCharge | null,
    noShowChargeValue: row.noShowChargeValue,
  }
}

/** A charge and its value agree: a percentage has a number, nothing else does. */
function pairIsValid(charge: CancelCharge, value: number | null): boolean {
  if (charge === "percent") {
    return value !== null && Number.isInteger(value) && value >= 1 && value <= 100
  }
  return value === null
}
