import { describe, expect, it } from "vitest"

import {
  AVAILABILITY_WINDOW_NIGHTS,
  BASELINE_CONVERSION,
  rankProperty,
  weakestFactor,
  type RankingInputs,
} from "./ranking"

const mature: RankingInputs = {
  listingScore: 90,
  rating: 4.6,
  reviewCount: 500,
  impressions: 10_000,
  clicks: 800,
  fromPrice: 50_000,
  marketMedianPrice: 50_000,
  sellableNights: 50,
  windowNights: AVAILABILITY_WINDOW_NIGHTS,
}

const factor = (input: RankingInputs, key: string) =>
  rankProperty(input).factors.find((f) => f.key === key)!

describe("search ranking", () => {
  it("scores out of 10000 so a database can sort on it", () => {
    const ranked = rankProperty(mature)
    expect(ranked.score).toBeGreaterThan(0)
    expect(ranked.score).toBeLessThanOrEqual(10_000)
    expect(Number.isInteger(ranked.score)).toBe(true)
  })

  it("gets an outstanding listing to the very top, but never quite to 10000", () => {
    const perfect = rankProperty({
      listingScore: 100,
      rating: 5,
      reviewCount: 10_000,
      impressions: 100_000,
      clicks: 100_000,
      fromPrice: 1,
      marketMedianPrice: 100_000,
      sellableNights: 60,
      windowNights: 60,
    })

    /*
     * 9999, not 10000 — and that is the smoothing being honest.
     *
     * The prior never fully washes out: ten thousand five-star reviews still
     * carry ten imaginary average ones, so the rating factor lands at 99.98
     * rather than 100. A perfect score would mean "no further evidence could
     * change this", which is not a claim a rate estimated from samples can
     * make.
     */
    expect(perfect.score).toBe(9_999)
    expect(perfect.score).toBeLessThan(10_000)
  })

  it("does not let three impressions and one click beat a proven listing", () => {
    /*
     * The whole reason the rates are smoothed. 1/3 is 33% and would otherwise
     * crush a mature listing converting at 8% on ten thousand impressions —
     * on noise.
     */
    const lucky = { ...mature, impressions: 3, clicks: 1 }
    expect(factor(lucky, "conversion").score).toBeLessThan(
      factor(mature, "conversion").score
    )
  })

  it("does not let one five-star review beat five hundred at 4.6", () => {
    const one = { ...mature, rating: 5, reviewCount: 1 }
    expect(factor(one, "rating").score).toBeLessThan(factor(mature, "rating").score)
  })

  it("treats an unreviewed listing as average, not as bad", () => {
    const fresh = { ...mature, rating: 0, reviewCount: 0 }
    const score = factor(fresh, "rating").score

    // 3.5 out of 5 is the baseline — a new listing is unknown, not poor.
    expect(score).toBeCloseTo(70, 0)
    expect(factor(fresh, "rating").detail).toContain("No reviews yet")
  })

  it("treats a listing nobody has seen as converting at the market rate", () => {
    const fresh = { ...mature, impressions: 0, clicks: 0 }
    // The baseline is half of full marks on this factor, by construction.
    expect(factor(fresh, "conversion").score).toBeCloseTo(50, 0)
    expect(factor(fresh, "conversion").detail).toContain("not appeared in search")
  })

  it("rewards a cheaper rate, but only gently", () => {
    const cheap = rankProperty({ ...mature, fromPrice: 25_000 })
    const dear = rankProperty({ ...mature, fromPrice: 100_000 })

    expect(cheap.score).toBeGreaterThan(dear.score)
    /*
     * Price is 15 of 100. Halving the rate against the market moves the total
     * by at most 15 points out of 100 — a marketplace that ranked hardest on
     * price would teach every partner to undercut, and the catalogue would
     * race to the bottom.
     */
    expect((cheap.score - dear.score) / 100).toBeLessThanOrEqual(15)
  })

  it("scores a sold-out property down without erasing it", () => {
    const soldOut = rankProperty({ ...mature, sellableNights: 0 })
    expect(factor({ ...mature, sellableNights: 0 }, "availability").score).toBe(0)
    // Still ranked — a property full this month is not a bad property.
    expect(soldOut.score).toBeGreaterThan(0)
  })

  it("survives a city with nothing to compare against", () => {
    const alone = rankProperty({ ...mature, marketMedianPrice: 0 })
    expect(factor({ ...mature, marketMedianPrice: 0 }, "price").score).toBe(50)
    expect(alone.score).toBeGreaterThan(0)
  })

  it("explains every factor, with its weight and what it contributed", () => {
    const ranked = rankProperty(mature)
    expect(ranked.factors).toHaveLength(5)

    for (const f of ranked.factors) {
      expect(f.detail.length).toBeGreaterThan(10)
      expect(f.weight).toBeGreaterThan(0)
      expect(f.contribution).toBeLessThanOrEqual(f.weight)
    }

    // The contributions add up to the score. A ranking a partner cannot check
    // is one they argue with.
    const total = ranked.factors.reduce((sum, f) => sum + f.contribution, 0)
    expect(Math.round(total * 100)).toBe(ranked.score)
  })

  it("names the factor worth fixing, weighted", () => {
    const ranked = rankProperty({
      ...mature,
      // 20 points lost on a factor worth 25 …
      listingScore: 80,
      // … against 40 lost on one worth 15.
      sellableNights: 24,
    })

    // 20 x 25 = 500 against 60 x 15 = 900, so availability is the answer.
    expect(weakestFactor(ranked)!.key).toBe("availability")
  })

  it("never lets a factor exceed its own weight", () => {
    const extreme = rankProperty({
      ...mature,
      listingScore: 200,
      rating: 9,
      clicks: 99_999,
      impressions: 1,
      sellableNights: 999,
    })
    for (const f of extreme.factors) {
      expect(f.contribution).toBeLessThanOrEqual(f.weight)
    }
    expect(extreme.score).toBeLessThanOrEqual(10_000)
  })

  it("keeps the baseline conversion where the scoring assumes it", () => {
    // Guards the constant the conversion factor is scaled against.
    expect(BASELINE_CONVERSION).toBeGreaterThan(0)
    expect(BASELINE_CONVERSION).toBeLessThan(0.5)
  })
})
