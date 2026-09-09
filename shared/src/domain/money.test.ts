import { describe, expect, it } from "vitest"

import {
  assertCents,
  bpsOf,
  clampNonNegative,
  isCents,
  percentOf,
  roundCents,
  sumCents,
  toCents,
  toDollars,
} from "./money"

describe("roundCents", () => {
  it("rounds half away from zero, symmetrically", () => {
    // The whole reason this exists instead of Math.round: discounts are
    // negative, and Math.round(-0.5) is -0 while Math.round(0.5) is 1.
    expect(roundCents(0.5)).toBe(1)
    expect(roundCents(-0.5)).toBe(-1)
    expect(roundCents(1.5)).toBe(2)
    expect(roundCents(-1.5)).toBe(-2)
  })

  it("leaves whole cents untouched", () => {
    expect(roundCents(243200)).toBe(243200)
    expect(roundCents(-32625)).toBe(-32625)
    expect(roundCents(0)).toBe(0)
  })

  it("rejects non-finite amounts rather than producing NaN downstream", () => {
    expect(() => roundCents(Number.NaN)).toThrow(RangeError)
    expect(() => roundCents(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})

describe("percentOf", () => {
  it("computes a percentage discount to the cent", () => {
    // Ritz: 3 nights × $725 = $2,175 room subtotal, 15% Genius discount
    expect(percentOf(217_500, 15)).toBe(32_625) // $326.25
  })

  it("rounds the fractional cent rather than truncating it", () => {
    expect(percentOf(333, 10)).toBe(33) // 33.3 → 33
    expect(percentOf(335, 10)).toBe(34) // 33.5 → 34
  })

  it("handles 0% and 100%", () => {
    expect(percentOf(217_500, 0)).toBe(0)
    expect(percentOf(217_500, 100)).toBe(217_500)
  })
})

describe("bpsOf", () => {
  it("computes commission from basis points", () => {
    // 15.00% of $2,432.00 = $364.80 — the figure that a dollars-based ledger
    // rounded to $365 and lost $0.20 on, every single booking.
    expect(bpsOf(243_200, 1500)).toBe(36_480)
  })

  it("expresses a negotiated half-percent exactly", () => {
    expect(bpsOf(243_200, 1250)).toBe(30_400) // 12.5%
  })

  it("covers the plan-tier defaults", () => {
    expect(bpsOf(243_200, 1800)).toBe(43_776) // starter
    expect(bpsOf(243_200, 1200)).toBe(29_184) // enterprise
  })
})

describe("sumCents", () => {
  it("sums an empty list to zero", () => {
    expect(sumCents([])).toBe(0)
  })

  it("sums mixed charges and discounts", () => {
    // room + add-ons − discount
    expect(sumCents([217_500, 25_700, -32_625])).toBe(210_575)
  })
})

describe("clampNonNegative", () => {
  it("floors negatives at zero", () => {
    // A first-night charge on a one-night stay must not produce a negative
    // refund that the platform would then owe the guest.
    expect(clampNonNegative(-500)).toBe(0)
    expect(clampNonNegative(0)).toBe(0)
    expect(clampNonNegative(500)).toBe(500)
  })
})

describe("conversion", () => {
  it("round-trips whole dollars", () => {
    expect(toCents(725)).toBe(72_500)
    expect(toDollars(72_500)).toBe(725)
  })

  it("survives the float representation of a fractional dollar", () => {
    // 24.32 * 100 is 2431.9999999999995 in IEEE-754; truncation would give 2431
    expect(toCents(24.32)).toBe(2432)
  })
})

describe("isCents / assertCents", () => {
  it("accepts whole numbers only", () => {
    expect(isCents(0)).toBe(true)
    expect(isCents(-32_625)).toBe(true)
    expect(isCents(24.32)).toBe(false)
    expect(isCents(Number.NaN)).toBe(false)
    expect(isCents("2432")).toBe(false)
    expect(isCents(null)).toBe(false)
  })

  it("names the offending field when it throws", () => {
    expect(() => assertCents(24.32, "roomSubtotal")).toThrow(/roomSubtotal/)
    expect(() => assertCents(2432, "roomSubtotal")).not.toThrow()
  })
})
