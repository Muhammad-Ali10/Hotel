import { describe, expect, it } from "vitest"

import type { BookingAddOn } from "../types/booking"
import type { ResolvedNight } from "../types/property"
import { makeNight } from "./night.fixture"
import {
  addOnsTotal,
  averageRatePerNight,
  discountAmount,
  discountLabel,
  nightlyDisplayPrice,
  priceBooking,
  roomSubtotal,
  strikethroughFor,
  valueAddPrice,
} from "./pricing"

/** Three nights at the Ritz Deluxe King — $725/night, flat. */
const flat3: ResolvedNight[] = ["2026-08-12", "2026-08-13", "2026-08-14"].map((date) =>
  makeNight({ date })
)

/** Same three nights, but the middle one is peak. */
const peakMiddle: ResolvedNight[] = [
  { ...flat3[0]!, rate: 40_000 },
  { ...flat3[1]!, rate: 90_000 },
  { ...flat3[2]!, rate: 40_000 },
]

const addOn = (amount: number): BookingAddOn => ({
  id: "a",
  valueAddId: "v",
  name: "x",
  unit: "per_stay",
  unitPrice: amount,
  qty: 1,
  amount,
})

describe("roomSubtotal / averageRatePerNight", () => {
  it("sums the per-night rates", () => {
    expect(roomSubtotal(flat3)).toBe(217_500) // 3 × $725
    expect(roomSubtotal(peakMiddle)).toBe(170_000)
  })

  it("averages for display without being used in the total", () => {
    expect(averageRatePerNight(170_000, 3)).toBe(56_667) // $566.67
    expect(averageRatePerNight(0, 0)).toBe(0)
  })
})

describe("discountAmount", () => {
  const stay = { roomSubtotal: 217_500, nights: flat3 }

  it("takes a percentage of the room subtotal", () => {
    expect(discountAmount({ type: "percent", value: 15 }, stay)).toBe(32_625)
    expect(discountAmount({ type: "percent", value: 20 }, stay)).toBe(43_500)
  })

  it("caps a fixed amount at the room subtotal", () => {
    expect(discountAmount({ type: "amount", value: 5_000 }, stay)).toBe(5_000)
    expect(discountAmount({ type: "amount", value: 999_999 }, stay)).toBe(217_500)
  })

  it("gives away the CHEAPEST night, not the average (rule #19)", () => {
    // $400 + $900 + $400. The cheapest night is $400 — taking the average
    // ($566.67) or the dearest ($900) would make the promotion cost the
    // partner most exactly when inventory is scarcest.
    const peakStay = { roomSubtotal: 170_000, nights: peakMiddle }
    expect(discountAmount({ type: "free_night", value: 3 }, peakStay)).toBe(40_000)
  })

  it("gives away the N cheapest nights when the stay earns several", () => {
    const six: ResolvedNight[] = [
      { ...flat3[0]!, rate: 90_000 },
      { ...flat3[0]!, rate: 30_000 },
      { ...flat3[0]!, rate: 80_000 },
      { ...flat3[0]!, rate: 20_000 },
      { ...flat3[0]!, rate: 70_000 },
      { ...flat3[0]!, rate: 60_000 },
    ]
    // 6 nights, every 3rd free → 2 free nights → the two cheapest, $200 + $300
    expect(discountAmount({ type: "free_night", value: 3 }, { roomSubtotal: 350_000, nights: six }))
      .toBe(50_000)
  })

  it("gives nothing when the stay is too short to earn a free night", () => {
    const two = { roomSubtotal: 145_000, nights: flat3.slice(0, 2) }
    expect(discountAmount({ type: "free_night", value: 3 }, two)).toBe(0)
  })

  it("returns zero for no discount, and never divides by zero", () => {
    expect(discountAmount(undefined, stay)).toBe(0)
    expect(discountAmount({ type: "free_night", value: 0 }, stay)).toBe(0)
  })
})

describe("valueAddPrice", () => {
  const stay = { nights: 3, guests: 2 }

  it("resolves every unit", () => {
    expect(valueAddPrice({ price: 6_500, unit: "per_stay" }, stay)).toBe(6_500) // transfer $65
    expect(valueAddPrice({ price: 2_500, unit: "per_night" }, stay)).toBe(7_500)
    expect(valueAddPrice({ price: 12_000, unit: "per_person" }, stay)).toBe(24_000) // spa $120
  })

  it("prices Daily breakfast correctly with the new unit (rule #10)", () => {
    // The prototype charged $32 per person ONCE — $64 for six breakfasts.
    expect(valueAddPrice({ price: 3_200, unit: "per_person_per_night" }, stay)).toBe(19_200)
  })

  it("multiplies by qty AFTER the unit resolves (rule #23)", () => {
    // $120 per person, 2 guests, qty 2 → two treatments each
    expect(valueAddPrice({ price: 12_000, unit: "per_person" }, stay, 2)).toBe(48_000)
    expect(valueAddPrice({ price: 6_500, unit: "per_stay" }, stay, 3)).toBe(19_500)
  })

  it("treats a zero or negative qty as nothing bought", () => {
    expect(valueAddPrice({ price: 6_500, unit: "per_stay" }, stay, 0)).toBe(0)
    expect(valueAddPrice({ price: 6_500, unit: "per_stay" }, stay, -2)).toBe(0)
  })
})

describe("priceBooking", () => {
  it("prices the reference booking with no tax layer (rule #11)", () => {
    // Ritz, Deluxe King, 3 nights, 2 guests, transfer + daily breakfast.
    const pricing = priceBooking({
      nights: flat3,
      guests: 2,
      addOns: [addOn(6_500), addOn(19_200)],
    })

    expect(pricing.nights).toBe(3)
    expect(pricing.roomSubtotal).toBe(217_500)
    expect(pricing.addOnsTotal).toBe(25_700)
    expect(pricing.discount).toBeUndefined()
    expect(pricing.total).toBe(243_200) // $2,432 — no VAT, no service, no city tax
  })

  it("applies a discount to the room only, never to add-ons", () => {
    const pricing = priceBooking({
      nights: flat3,
      guests: 2,
      addOns: [addOn(6_500), addOn(19_200)],
      discount: { type: "percent", value: 15, promotionId: "promo-genius" },
    })

    expect(pricing.discount).toEqual({
      id: "promo-genius",
      label: "15% OFF",
      amount: -32_625,
    })
    // 217500 − 32625 + 25700
    expect(pricing.total).toBe(210_575)
  })

  it("keeps the breakdown summing exactly to the total", () => {
    const pricing = priceBooking({
      nights: peakMiddle,
      guests: 2,
      addOns: [addOn(6_500)],
      discount: { type: "percent", value: 17 },
    })
    const lines =
      pricing.roomSubtotal + (pricing.discount?.amount ?? 0) + pricing.addOnsTotal
    expect(lines).toBe(pricing.total)
  })

  it("never returns a negative total", () => {
    const pricing = priceBooking({
      nights: flat3,
      guests: 2,
      addOns: [],
      discount: { type: "amount", value: 999_999 },
    })
    expect(pricing.total).toBe(0)
  })

  it("handles an empty stay without dividing by zero", () => {
    const pricing = priceBooking({ nights: [], guests: 2, addOns: [] })
    expect(pricing).toMatchObject({ nights: 0, ratePerNight: 0, roomSubtotal: 0, total: 0 })
  })
})

describe("strikethroughFor", () => {
  it("works for every discount type (rule #7)", () => {
    for (const d of [
      { type: "percent", value: 20 },
      { type: "amount", value: 5_000 },
      { type: "free_night", value: 3 },
    ] as const) {
      const pricing = priceBooking({ nights: flat3, guests: 2, addOns: [], discount: d })
      const strike = strikethroughFor(pricing)
      expect(strike).not.toBeNull()
      expect(strike!.original).toBe(217_500)
      expect(strike!.final).toBeLessThan(strike!.original)
    }
  })

  it("returns null when nothing was discounted", () => {
    const pricing = priceBooking({ nights: flat3, guests: 2, addOns: [] })
    expect(strikethroughFor(pricing)).toBeNull()
  })
})

describe("nightlyDisplayPrice", () => {
  it("discounts a percent offer on the card", () => {
    expect(nightlyDisplayPrice(72_500, { type: "percent", value: 20 })).toEqual({
      original: 72_500,
      final: 58_000,
    })
  })

  it("refuses to invent a nightly figure for stay-level offers", () => {
    // $50 off and "3rd night free" have no honest per-night equivalent — the
    // badge carries the offer instead of quoting a price the guest can never
    // actually be charged.
    expect(nightlyDisplayPrice(72_500, { type: "amount", value: 5_000 })).toEqual({
      original: null,
      final: 72_500,
    })
    expect(nightlyDisplayPrice(72_500, { type: "free_night", value: 3 })).toEqual({
      original: null,
      final: 72_500,
    })
    expect(nightlyDisplayPrice(72_500)).toEqual({ original: null, final: 72_500 })
  })
})

describe("discountLabel", () => {
  it("describes each type once, for every surface", () => {
    expect(discountLabel({ type: "percent", value: 15 })).toBe("15% OFF")
    expect(discountLabel({ type: "amount", value: 5_000 })).toBe("$50 OFF")
    expect(discountLabel({ type: "free_night", value: 3 })).toBe("3rd Night Free")
    expect(discountLabel({ type: "free_night", value: 2 })).toBe("2nd Night Free")
    expect(discountLabel({ type: "free_night", value: 4 })).toBe("4th Night Free")
  })
})

describe("addOnsTotal", () => {
  it("sums resolved amounts", () => {
    expect(addOnsTotal([])).toBe(0)
    expect(addOnsTotal([addOn(6_500), addOn(19_200)])).toBe(25_700)
  })
})
