import type { Cents } from "../types/common"

/* ============================================================================
 * Per-guest pricing (rule #101).
 *
 * A hotel does not charge a solo traveller what it charges a family of four in
 * the same room. Until this existed, Stayora did: the nightly rate ignored
 * occupancy entirely.
 *
 * The matrix stores the FULL nightly price at each party size, because that is
 * how a partner thinks about it and what the screen shows. It is APPLIED as a
 * difference from the base occupancy, so a calendar override for a busy week
 * lifts every party size with it — see `occupancyAdjustment`.
 * ========================================================================== */

/** What a rate plan charges at one party size. */
export type OccupancyPrice = {
  /** Adults. Children have their own allowance and are not priced per head. */
  guests: number
  /** CENTS — the full nightly price at this occupancy, at the plan's own rate. */
  price: Cents
}

/**
 * How much this party size adds to (or takes off) a night's rate.
 *
 * Zero unless the matrix has BOTH the requested size and the base occupancy:
 * a difference needs two numbers, and inventing the missing one would invent a
 * price. A plan with no matrix at all therefore charges the same whatever the
 * party size, which is exactly how every plan behaves today.
 *
 * A party larger than anything in the matrix is charged at the largest level
 * the partner actually set — deliberately, and it is the safe direction. The
 * alternative, extrapolating, would quote a number nobody entered; refusing
 * would make a room the guest is entitled to occupy unbookable.
 */
export function occupancyAdjustment(input: {
  guests: number
  baseOccupancy: number
  matrix: readonly OccupancyPrice[]
}): Cents {
  if (input.matrix.length === 0) return 0

  const base = input.matrix.find((row) => row.guests === input.baseOccupancy)
  if (!base) return 0

  const exact = input.matrix.find((row) => row.guests === input.guests)
  if (exact) return exact.price - base.price

  /*
   * Below the smallest level set: no discount is invented. A partner who wants
   * a single-occupancy rate sets one; one who has not is charging their base
   * rate, and quietly discounting on their behalf would give away money they
   * never agreed to give.
   */
  const sorted = [...input.matrix].sort((a, b) => a.guests - b.guests)
  const largest = sorted[sorted.length - 1]!
  if (input.guests > largest.guests) return largest.price - base.price

  return 0
}

/**
 * A night's rate for a given party size.
 *
 * `nightlyRate` is whatever the calendar already resolved for that date — the
 * plan's base price, or the override the partner set for that night. The
 * adjustment rides on top, which is what makes a seasonal rate change carry
 * through to every party size.
 *
 * Floored at zero: a matrix where a smaller party costs more than the base
 * could otherwise drive a night negative, and a negative night would flow
 * straight into a total.
 */
export function nightlyRateFor(input: {
  nightlyRate: Cents
  guests: number
  baseOccupancy: number
  matrix: readonly OccupancyPrice[]
}): Cents {
  const adjusted =
    input.nightlyRate +
    occupancyAdjustment({
      guests: input.guests,
      baseOccupancy: input.baseOccupancy,
      matrix: input.matrix,
    })
  return Math.max(0, adjusted)
}

/**
 * The matrix as the screen shows it: absolute prices, base level filled in.
 *
 * The base occupancy always appears, even when the partner has set no rows —
 * otherwise the grid opens empty on a plan that does have a price, and looks
 * broken rather than unconfigured.
 */
export function occupancyGrid(input: {
  basePrice: Cents
  baseOccupancy: number
  maxAdults: number
  matrix: readonly OccupancyPrice[]
}): { guests: number; price: Cents; isSet: boolean }[] {
  const byGuests = new Map(input.matrix.map((row) => [row.guests, row.price]))

  return Array.from({ length: Math.max(1, input.maxAdults) }, (_, i) => {
    const guests = i + 1
    const set = byGuests.get(guests)
    if (set !== undefined) return { guests, price: set, isSet: true }
    if (guests === input.baseOccupancy) {
      return { guests, price: input.basePrice, isSet: false }
    }
    return {
      guests,
      price: Math.max(
        0,
        input.basePrice +
          occupancyAdjustment({
            guests,
            baseOccupancy: input.baseOccupancy,
            matrix: input.matrix,
          })
      ),
      isSet: false,
    }
  })
}
