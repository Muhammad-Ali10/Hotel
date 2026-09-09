import { describe, expect, it } from "vitest"

import {
  nightlyRateFor,
  occupancyAdjustment,
  occupancyGrid,
  type OccupancyPrice,
} from "./occupancy-pricing"

/** 1 guest $474, 2 guests $520, 3 guests $560 — the shape the screen shows. */
const matrix: OccupancyPrice[] = [
  { guests: 1, price: 47_400 },
  { guests: 2, price: 52_000 },
  { guests: 3, price: 56_000 },
]

describe("per-guest pricing", () => {
  it("charges the same at every party size when nothing is configured", () => {
    for (const guests of [1, 2, 3, 4]) {
      expect(
        nightlyRateFor({ nightlyRate: 60_000, guests, baseOccupancy: 2, matrix: [] })
      ).toBe(60_000)
    }
  })

  it("adds the difference from the base occupancy, not the stored price", () => {
    // The matrix says 3 guests is $560 at the plan's own $520 base - $40 more.
    expect(occupancyAdjustment({ guests: 3, baseOccupancy: 2, matrix })).toBe(4_000)
    expect(occupancyAdjustment({ guests: 1, baseOccupancy: 2, matrix })).toBe(-4_600)
    expect(occupancyAdjustment({ guests: 2, baseOccupancy: 2, matrix })).toBe(0)
  })

  it("carries a seasonal rate change through to every party size", () => {
    /*
     * The point of storing the difference. A busy week priced at $900 must
     * charge a family of three $940, not the $560 the matrix literally says -
     * otherwise raising the June rate raises only the two-guest price.
     */
    expect(
      nightlyRateFor({ nightlyRate: 90_000, guests: 3, baseOccupancy: 2, matrix })
    ).toBe(94_000)
    expect(
      nightlyRateFor({ nightlyRate: 90_000, guests: 1, baseOccupancy: 2, matrix })
    ).toBe(85_400)
  })

  it("does not invent a difference when the base occupancy is not in the matrix", () => {
    // A difference needs two numbers. One of them missing means no answer, not
    // a guessed one.
    const partial: OccupancyPrice[] = [{ guests: 4, price: 70_000 }]
    expect(occupancyAdjustment({ guests: 4, baseOccupancy: 2, matrix: partial })).toBe(0)
  })

  it("charges a larger party at the largest level actually set", () => {
    // Extrapolating would quote a number nobody entered; refusing would make a
    // room the guest may legitimately occupy unbookable.
    expect(occupancyAdjustment({ guests: 6, baseOccupancy: 2, matrix })).toBe(4_000)
  })

  it("never discounts a party size the partner did not price", () => {
    const fromTwo: OccupancyPrice[] = [
      { guests: 2, price: 52_000 },
      { guests: 3, price: 56_000 },
    ]
    // No single-occupancy rate was set, so one guest pays the base rate.
    // Inventing a discount gives away money nobody agreed to give away.
    expect(occupancyAdjustment({ guests: 1, baseOccupancy: 2, matrix: fromTwo })).toBe(0)
  })

  it("never lets a night go negative", () => {
    const steep: OccupancyPrice[] = [
      { guests: 1, price: 1_000 },
      { guests: 2, price: 90_000 },
    ]
    expect(
      nightlyRateFor({ nightlyRate: 20_000, guests: 1, baseOccupancy: 2, matrix: steep })
    ).toBe(0)
  })

  it("shows a grid up to the room's capacity, with the base level filled in", () => {
    const grid = occupancyGrid({
      basePrice: 52_000,
      baseOccupancy: 2,
      maxAdults: 4,
      matrix: [],
    })

    expect(grid).toHaveLength(4)
    // The base level always has a price even with nothing configured, so an
    // unconfigured grid reads as unconfigured rather than as broken.
    expect(grid[1]).toEqual({ guests: 2, price: 52_000, isSet: false })
    expect(grid.every((row) => row.price === 52_000)).toBe(true)
    expect(grid.every((row) => row.isSet === false)).toBe(true)
  })

  it("marks which levels the partner actually set", () => {
    const grid = occupancyGrid({
      basePrice: 52_000,
      baseOccupancy: 2,
      maxAdults: 4,
      matrix,
    })

    expect(grid.map((r) => r.isSet)).toEqual([true, true, true, false])
    expect(grid[0]).toMatchObject({ guests: 1, price: 47_400 })
    // The fourth level was never set, so it follows the largest one that was.
    expect(grid[3]).toMatchObject({ guests: 4, price: 56_000 })
  })
})
