import type { Cents } from "../types/common"

/* ============================================================================
 * Money arithmetic. Everything here works in integer minor units (cents).
 *
 * Rounding policy (docs/ARCHITECTURE.md §1.1):
 *   - each price LINE is rounded to a whole cent
 *   - the total is the SUM OF THE ROUNDED LINES, never a separately rounded
 *     figure — otherwise the lines a guest reads do not add up to the total
 *     they are charged, which is the classic invoice bug
 * ========================================================================== */

/**
 * Rounds to a whole cent, **half away from zero**.
 *
 * Not `Math.round`: that rounds half towards +Infinity, so `-0.5` becomes `-0`
 * while `0.5` becomes `1`. Discounts are negative, so a naive `Math.round`
 * would round discounts and charges in opposite directions and leave a
 * one-cent drift that only ever favours one side.
 */
export function roundCents(value: number): Cents {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Cannot round a non-finite amount: ${value}`)
  }
  return value < 0 ? -Math.round(-value) : Math.round(value)
}

/** `percent` of `amount`, e.g. `percentOf(217500, 15)` → 32625 ($326.25). */
export function percentOf(amount: Cents, percent: number): Cents {
  return roundCents((amount * percent) / 100)
}

/**
 * Basis points of an amount — `bpsOf(243200, 1500)` → 36480 ($364.80).
 *
 * Commission rates are stored in bps rather than as a decimal fraction so a
 * negotiated 12.5% is exactly `1250` and never a float.
 */
export function bpsOf(amount: Cents, bps: number): Cents {
  return roundCents((amount * bps) / 10_000)
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0
  for (const v of values) total += v
  return total
}

/** Refunds and discounts must never push a figure below zero. */
export function clampNonNegative(value: Cents): Cents {
  return value < 0 ? 0 : value
}

/* ------------------------------------------------------------ conversion -- */

/**
 * Dollars → cents. Used ONLY at the seed/migration boundary, where the
 * prototype's whole-dollar fixtures are read in. Never inside a calculation.
 */
export function toCents(dollars: number): Cents {
  return roundCents(dollars * 100)
}

/**
 * Cents → dollars, for formatting at the API edge. Returns a float on purpose:
 * the caller is about to render it, not compute with it.
 */
export function toDollars(cents: Cents): number {
  return cents / 100
}

/** True when `value` is a whole, finite, safe integer — i.e. a valid `Cents`. */
export function isCents(value: unknown): value is Cents {
  return typeof value === "number" && Number.isSafeInteger(value)
}

/**
 * Throws unless `value` is a whole number of cents.
 *
 * Used at the edges of the domain — where money arrives from a request body,
 * a database row or a fixture — so a stray float is caught at the boundary
 * instead of silently propagating through a price breakdown.
 */
export function assertCents(value: unknown, label = "amount"): asserts value is Cents {
  if (!isCents(value)) {
    throw new TypeError(`${label} must be a whole number of cents, received: ${String(value)}`)
  }
}
