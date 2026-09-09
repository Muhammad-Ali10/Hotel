import { describe, expect, it } from "vitest"

import { GENIUS_STAYS_REQUIRED, earnedTier, tierUpgradeFor } from "./loyalty"

describe("earnedTier", () => {
  it("needs the documented number of completed stays", () => {
    expect(GENIUS_STAYS_REQUIRED).toBe(2)
    expect(earnedTier(0)).toBe("standard")
    expect(earnedTier(1)).toBe("standard")
    expect(earnedTier(2)).toBe("genius")
    expect(earnedTier(50)).toBe("genius")
  })
})

describe("tierUpgradeFor", () => {
  it("promotes on the qualifying stay", () => {
    expect(tierUpgradeFor({ current: "standard", completedStays: 2 })).toBe("genius")
  })

  it("says nothing when there is nothing to change", () => {
    expect(tierUpgradeFor({ current: "standard", completedStays: 1 })).toBeNull()
    expect(tierUpgradeFor({ current: "genius", completedStays: 5 })).toBeNull()
  })

  it("never moves an account down (rule #53)", () => {
    // A tier that could fall means a guest opening the same page a month later
    // and finding it dearer, with nothing on the screen to explain why.
    expect(tierUpgradeFor({ current: "genius", completedStays: 0 })).toBeNull()
    expect(tierUpgradeFor({ current: "genius", completedStays: 1 })).toBeNull()
  })
})
