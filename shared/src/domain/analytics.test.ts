import { describe, expect, it } from "vitest"

import {
  adr,
  allocateNightly,
  BOOK_WINDOW_BUCKETS,
  bookWindowBucket,
  canSeeRevenue,
  deltaFraction,
  FEE_STATUSES,
  MARKET_MIN_SAMPLE,
  marketAggregate,
  occupancy,
  REALISED_STATUSES,
  revpar,
  versusMarket,
} from "./analytics"

describe("which bookings count (rule #63)", () => {
  it("never counts a pending hold as a sale", () => {
    expect(REALISED_STATUSES).not.toContain("pending")
  })

  it("keeps fee-only statuses out of the room-night statuses", () => {
    for (const status of FEE_STATUSES) {
      expect(REALISED_STATUSES).not.toContain(status)
    }
  })

  it("counts a cancellation and a no-show as fees, not stays", () => {
    expect(FEE_STATUSES).toEqual(["cancelled", "no_show"])
  })
})

describe("adr", () => {
  it("divides room revenue by nights SOLD", () => {
    expect(adr(90_000, 3)).toBe(30_000)
  })

  it("is zero when nothing sold, rather than dividing by zero", () => {
    expect(adr(90_000, 0)).toBe(0)
  })

  it("rounds to whole cents", () => {
    expect(adr(10_000, 3)).toBe(3_333)
  })
})

describe("occupancy", () => {
  it("is nights sold over nights available", () => {
    expect(occupancy(78, 100)).toBeCloseTo(0.78, 10)
  })

  it("is zero when nothing was on sale", () => {
    expect(occupancy(0, 0)).toBe(0)
  })

  /*
   * `booked_units <= sellable_units` is a database CHECK, so this cannot
   * happen from the booking path. It CAN happen from a partner closing rooms
   * after they sold, and a screen reading "112% full" destroys trust in every
   * other number on the page.
   */
  it("clamps above 1 rather than reporting impossible occupancy", () => {
    expect(occupancy(112, 100)).toBe(1)
  })
})

describe("revpar", () => {
  it("divides room revenue by nights AVAILABLE, not sold", () => {
    // 78 nights sold out of 100 available, $300 each.
    expect(revpar(78 * 30_000, 100)).toBe(23_400)
  })

  it("stays close to adr × occupancy without being derived from it", () => {
    const revenue = 78 * 30_000
    const derived = adr(revenue, 78) * occupancy(78, 100)
    expect(Math.abs(revpar(revenue, 100) - derived)).toBeLessThanOrEqual(1)
  })

  it("is zero when no room was available", () => {
    expect(revpar(50_000, 0)).toBe(0)
  })
})

describe("deltaFraction", () => {
  it("reports a rise as a positive fraction", () => {
    expect(deltaFraction(114_300, 100_000)).toBeCloseTo(0.143, 10)
  })

  it("reports a fall as a negative fraction", () => {
    expect(deltaFraction(90, 100)).toBeCloseTo(-0.1, 10)
  })

  it("refuses to invent a percentage when the previous period was zero", () => {
    expect(deltaFraction(500, 0)).toBeNull()
  })
})

describe("bookWindowBucket", () => {
  it("puts a same-day booking in its own bucket", () => {
    expect(bookWindowBucket(0)).toBe("same_day")
  })

  it("clamps a negative lead time — a walk-in entered after midnight", () => {
    expect(bookWindowBucket(-1)).toBe("same_day")
  })

  it("places each boundary in the bucket that claims it", () => {
    expect(bookWindowBucket(3)).toBe("1_3")
    expect(bookWindowBucket(4)).toBe("4_7")
    expect(bookWindowBucket(30)).toBe("15_30")
    expect(bookWindowBucket(31)).toBe("31_60")
    expect(bookWindowBucket(61)).toBe("61_plus")
    expect(bookWindowBucket(400)).toBe("61_plus")
  })

  it("leaves no gap and no overlap between buckets", () => {
    for (let days = 0; days <= 365; days += 1) {
      const key = bookWindowBucket(days)
      const matching = BOOK_WINDOW_BUCKETS.filter(
        (b) => days >= b.minDays && (b.maxDays === null || days <= b.maxDays)
      )
      expect(matching).toHaveLength(1)
      expect(matching[0]!.key).toBe(key)
    }
  })
})

describe("market aggregate (rule #65)", () => {
  it("publishes nothing below the minimum sample", () => {
    const values = Array.from({ length: MARKET_MIN_SAMPLE - 1 }, () => 30_000)
    expect(marketAggregate(values)).toBeNull()
  })

  it("publishes at exactly the minimum sample", () => {
    const values = Array.from({ length: MARKET_MIN_SAMPLE }, () => 30_000)
    expect(marketAggregate(values)).toEqual({ average: 30_000, sample: MARKET_MIN_SAMPLE })
  })

  /*
   * The reason the floor exists. With two properties, a partner who knows
   * their own rate recovers the other's exactly: 2 × average − mine.
   */
  it("suppresses the case where the average is reversible", () => {
    expect(marketAggregate([30_000, 50_000])).toBeNull()
  })

  it("suppression survives the comparison instead of leaking through it", () => {
    expect(versusMarket(30_000, null)).toBeNull()
  })

  it("reports how far above market a property sits", () => {
    expect(versusMarket(32_400, 30_000)).toBeCloseTo(0.08, 10)
  })

  it("does not divide by a zero market", () => {
    expect(versusMarket(30_000, 0)).toBeNull()
  })
})

describe("canSeeRevenue (rule #66)", () => {
  it("lets an org admin and a manager see money", () => {
    expect(canSeeRevenue("admin")).toBe(true)
    expect(canSeeRevenue("manager")).toBe(true)
  })

  it("keeps money away from front-desk staff", () => {
    expect(canSeeRevenue("staff")).toBe(false)
  })

  it("is closed to anything it does not recognise", () => {
    expect(canSeeRevenue("owner")).toBe(false)
    expect(canSeeRevenue("")).toBe(false)
  })
})

describe("allocateNightly (rule #62)", () => {
  it("leaves undiscounted nights exactly as they were", () => {
    expect(allocateNightly({ nightlyRates: [70_000, 75_000, 72_500], discount: 0 })).toEqual([
      70_000, 75_000, 72_500,
    ])
  })

  it("takes the discount in proportion to each night's rate", () => {
    // $700 + $300 = $1000, less $100 → the pricier night gives up $70.
    expect(allocateNightly({ nightlyRates: [70_000, 30_000], discount: 10_000 })).toEqual([
      63_000, 27_000,
    ])
  })

  /*
   * The property of this function that everything downstream depends on. If
   * the parts do not add to the whole, a property's analytics revenue and its
   * payout statement disagree by amounts nobody can trace.
   */
  it("always sums to exactly subtotal − discount, however the shares round", () => {
    const cases: { nightlyRates: number[]; discount: number }[] = [
      { nightlyRates: [10_000, 10_000, 10_000], discount: 1 },
      { nightlyRates: [33_333, 33_333, 33_334], discount: 7 },
      { nightlyRates: [1, 1, 1, 1, 1, 1, 1], discount: 3 },
      { nightlyRates: [99_999, 1], discount: 33_333 },
      { nightlyRates: [12_345, 67_890, 11_111, 4_321], discount: 9_999 },
    ]

    for (const input of cases) {
      const subtotal = input.nightlyRates.reduce((a, b) => a + b, 0)
      const parts = allocateNightly(input)
      expect(parts.reduce((a, b) => a + b, 0)).toBe(subtotal - input.discount)
      expect(parts).toHaveLength(input.nightlyRates.length)
    }
  })

  it("gives back one figure per night, always", () => {
    expect(allocateNightly({ nightlyRates: [1, 2, 3, 4, 5], discount: 15 })).toHaveLength(5)
  })

  it("handles a stay given away entirely", () => {
    const parts = allocateNightly({ nightlyRates: [50_000, 50_000], discount: 100_000 })
    expect(parts).toEqual([0, 0])
  })

  it("never lets a discount exceed the subtotal and go negative", () => {
    const parts = allocateNightly({ nightlyRates: [10_000], discount: 999_999 })
    expect(parts).toEqual([0])
  })

  it("ignores a negative discount rather than inflating revenue", () => {
    expect(allocateNightly({ nightlyRates: [10_000], discount: -5_000 })).toEqual([10_000])
  })

  it("has nothing to say about a stay with no nights", () => {
    expect(allocateNightly({ nightlyRates: [], discount: 0 })).toEqual([])
  })

  it("survives a stay where every night was loaded at zero", () => {
    expect(allocateNightly({ nightlyRates: [0, 0], discount: 0 })).toEqual([0, 0])
  })
})
