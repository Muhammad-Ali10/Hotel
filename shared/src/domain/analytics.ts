import type { Cents } from "../types/common"
import { roundCents } from "./money"

/* ============================================================================
 * The arithmetic behind every analytics screen.
 *
 * Kept here, away from SQL, for the reason every other domain file exists: a
 * number a hotelier prices against must be testable without a database. ADR,
 * occupancy and RevPAR have exact definitions the industry agrees on, and
 * getting one subtly wrong is invisible — the figure still looks plausible.
 * ========================================================================== */

/* ------------------------------------------------------ which bookings count */

/**
 * Bookings that sold a room-night (rule #63).
 *
 * `pending` is absent on purpose: it is a fifteen-minute hold that has not paid
 * yet, and counting it would let anybody inflate a property's occupancy by
 * starting checkouts they never finish.
 */
export const REALISED_STATUSES = ["confirmed", "checked_in", "completed"] as const

/**
 * Bookings that produced money but no room-night (rule #63).
 *
 * A cancellation penalty and a no-show charge are revenue — the property
 * really did get paid. They are NOT room-nights: nobody slept there, and the
 * room went back on sale. Mixing them into ADR would show a rate the property
 * never actually achieved.
 */
export const FEE_STATUSES = ["cancelled", "no_show"] as const

export type RealisedStatus = (typeof REALISED_STATUSES)[number]

/* ------------------------------------------------------------------ metrics */

/**
 * Average Daily Rate — room revenue per room-night SOLD.
 *
 * The denominator is nights sold, never nights available; that second one is
 * RevPAR. Room revenue only (rule #64): a hotel that counts breakfast in its
 * ADR believes it is achieving a higher rate than it is, and prices upward
 * from a number that was never real.
 */
export function adr(roomRevenue: Cents, roomNightsSold: number): Cents {
  return roomNightsSold > 0 ? roundCents(roomRevenue / roomNightsSold) : 0
}

/**
 * Occupancy as a fraction in `[0, 1]` — nights sold over nights available.
 *
 * Available means sellable: a room closed for maintenance was never on sale,
 * so counting it would punish the property for taking a room out of service.
 * That is why the denominator comes from `room_inventory.sellable_units` and
 * not from a room count.
 */
export function occupancy(roomNightsSold: number, roomNightsAvailable: number): number {
  if (roomNightsAvailable <= 0) return 0
  return clamp01(roomNightsSold / roomNightsAvailable)
}

/**
 * Revenue Per Available Room — room revenue over nights AVAILABLE.
 *
 * The number that settles the argument ADR and occupancy have with each other:
 * a property can raise its rate and empty the house, or fill it and give the
 * rooms away, and both look like wins on one metric alone. RevPAR moves only
 * when the combination improves.
 *
 * Computed from the two totals rather than as `adr × occupancy` — that
 * identity holds in exact arithmetic but not after two roundings.
 */
export function revpar(roomRevenue: Cents, roomNightsAvailable: number): Cents {
  return roomNightsAvailable > 0 ? roundCents(roomRevenue / roomNightsAvailable) : 0
}

/**
 * Period-over-period change as a fraction: `0.143` is "+14.3%".
 *
 * `null` when the previous period is zero — the honest answer. Reporting an
 * increase from nothing as "+100%" or "∞" is a number that means nothing, and
 * a screen full of "+100%" is one a hotelier stops reading.
 */
export function deltaFraction(current: number, previous: number): number | null {
  if (previous === 0) return null
  return (current - previous) / previous
}

/* -------------------------------------------------------------- book window */

/**
 * How far ahead people book.
 *
 * Buckets rather than an average because the distribution has two humps —
 * last-minute city breaks and holidays booked half a year out — and a single
 * mean lands in the empty valley between them, describing nobody.
 */
export const BOOK_WINDOW_BUCKETS = [
  { key: "same_day", label: "Same day", minDays: 0, maxDays: 0 },
  { key: "1_3", label: "1–3 days", minDays: 1, maxDays: 3 },
  { key: "4_7", label: "4–7 days", minDays: 4, maxDays: 7 },
  { key: "8_14", label: "1–2 weeks", minDays: 8, maxDays: 14 },
  { key: "15_30", label: "2–4 weeks", minDays: 15, maxDays: 30 },
  { key: "31_60", label: "1–2 months", minDays: 31, maxDays: 60 },
  { key: "61_plus", label: "2+ months", minDays: 61, maxDays: null },
] as const

export type BookWindowKey = (typeof BOOK_WINDOW_BUCKETS)[number]["key"]

/**
 * Which bucket a lead time falls in.
 *
 * Negative lead times are clamped to zero rather than rejected: a walk-in
 * entered after midnight for "tonight" computes as −1 day, and that is a real
 * booking a real property took, not bad data to throw away.
 */
export function bookWindowBucket(leadDays: number): BookWindowKey {
  const days = Math.max(0, Math.floor(leadDays))
  for (const bucket of BOOK_WINDOW_BUCKETS) {
    if (bucket.maxDays === null || days <= bucket.maxDays) return bucket.key
  }
  return "61_plus"
}

/* ------------------------------------------------------------ market data */

/**
 * Below this many properties, a market aggregate is not published (rule #65).
 *
 * Five is the smallest number at which the average stops being reversible. In
 * a market of two, a partner who knows their own ADR and the average has the
 * competitor's exact rate by subtraction — the anonymity would be decorative.
 */
export const MARKET_MIN_SAMPLE = 5

/**
 * A market average, or `null` when too few properties contribute (rule #65).
 *
 * Returning `null` rather than the figure is the whole protection: a caller
 * that has to handle the empty case cannot accidentally render a number that
 * identifies somebody.
 */
export function marketAggregate(values: readonly number[]): {
  average: number
  sample: number
} | null {
  if (values.length < MARKET_MIN_SAMPLE) return null
  const total = values.reduce((sum, value) => sum + value, 0)
  return { average: total / values.length, sample: values.length }
}

/**
 * How a property compares, as a fraction: `0.08` is "8% above market".
 *
 * `null` when the market has too few properties to publish, so the suppression
 * survives the comparison instead of leaking through it.
 */
export function versusMarket(mine: number, market: number | null): number | null {
  if (market === null || market === 0) return null
  return (mine - market) / market
}

/* ------------------------------------------------------------------- access */

/** Who may see money on an analytics screen (rule #66). */
export const REVENUE_ROLES = ["admin", "manager"] as const

/**
 * Whether a team member sees revenue, ADR, RevPAR and commission.
 *
 * `staff` gets the operational half — bookings, occupancy, cancellations, book
 * window — which is what a front desk actually works from. The split keeps one
 * stolen front-desk password away from the property's whole commercial position.
 */
export function canSeeRevenue(role: string): boolean {
  return (REVENUE_ROLES as readonly string[]).includes(role)
}

/* ------------------------------------------------------------------ helpers */

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

/* ------------------------------------------------- nightly revenue split -- */

/**
 * A booking's room revenue, split across the nights it covers (rule #62).
 *
 * Stay-date metrics need this: a stay from 30 March to 2 April is two nights of
 * March revenue and one of April, and no amount of grouping by `check_in` will
 * produce that. Nights already have their own rates, so the only real work is
 * the promotion — a discount is stored as one figure for the whole stay and has
 * to be pushed back onto the nights it came off.
 *
 * Spread in proportion to each night's rate, so a discount on a stay with a
 * $700 night and a $300 night takes 70% of itself from the first. Flat-per-night
 * would make a cheap night look cheaper than any rate the property ever loaded.
 *
 * **The result sums to exactly `roomSubtotal − discount`.** Proportional shares
 * round independently and drift a cent or two; the last night absorbs whatever
 * is left over. Without that, a property's analytics revenue and its payout
 * statement disagree by small amounts that are impossible to explain and
 * impossible to find.
 *
 * `free_night` promotions are a deliberate exception to the proportionality:
 * they zero specific nights, but only the total survives onto the booking, so
 * the nights carry a share each. The stay's total is right, which is what any
 * sum over a date range depends on.
 */
export function allocateNightly(input: {
  nightlyRates: readonly Cents[]
  /** `pricing.discount.amount` — a positive number that came OFF the subtotal. */
  discount: Cents
}): Cents[] {
  const rates = input.nightlyRates
  if (rates.length === 0) return []

  const subtotal = rates.reduce((sum, rate) => sum + rate, 0)
  const discount = Math.min(Math.max(0, input.discount), subtotal)
  const net = subtotal - discount

  // Every night free, or no rates loaded at all — nothing to apportion.
  if (subtotal === 0) return rates.map(() => 0)

  const allocated: Cents[] = []
  let running = 0
  for (let i = 0; i < rates.length - 1; i += 1) {
    const share = Math.round((rates[i]! / subtotal) * net)
    allocated.push(share)
    running += share
  }
  // The remainder, so the parts add up to the whole exactly.
  allocated.push(net - running)
  return allocated
}
