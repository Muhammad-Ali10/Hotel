import { describe, expect, it } from "vitest"

import {
  addDays,
  checkInInstant,
  datesInRange,
  daysBetween,
  isValidISODate,
  isValidTimeOfDay,
  nightsBetween,
  parseISODate,
  toISODate,
  zonedWallClockToInstant,
} from "./dates"

describe("isValidISODate", () => {
  it("accepts real dates", () => {
    expect(isValidISODate("2026-08-12")).toBe(true)
    expect(isValidISODate("2028-02-29")).toBe(true) // leap year
  })

  it("rejects dates that Date would silently roll forward", () => {
    // new Date("2026-02-30") becomes 2026-03-02 — a booking on a date that
    // does not exist must fail loudly, not quietly move.
    expect(isValidISODate("2026-02-30")).toBe(false)
    expect(isValidISODate("2026-13-01")).toBe(false)
    expect(isValidISODate("2027-02-29")).toBe(false) // not a leap year
  })

  it("rejects malformed input", () => {
    expect(isValidISODate("12-08-2026")).toBe(false)
    expect(isValidISODate("2026-8-12")).toBe(false)
    expect(isValidISODate("")).toBe(false)
  })
})

describe("parseISODate", () => {
  it("parses to UTC midnight regardless of host timezone", () => {
    expect(parseISODate("2026-08-12").toISOString()).toBe("2026-08-12T00:00:00.000Z")
  })

  it("round-trips through toISODate", () => {
    expect(toISODate(parseISODate("2026-08-12"))).toBe("2026-08-12")
  })
})

describe("nightsBetween", () => {
  it("counts nights, not days", () => {
    expect(nightsBetween("2026-08-12", "2026-08-15")).toBe(3)
  })

  it("returns 0 for a same-day stay and negative for a reversed one", () => {
    expect(nightsBetween("2026-08-12", "2026-08-12")).toBe(0)
    expect(nightsBetween("2026-08-15", "2026-08-12")).toBe(-3)
  })

  it("is unaffected by a DST transition in the middle", () => {
    // US DST ends 2026-11-01. Naive local-time maths would give 30.04 nights
    // here and round wrong; UTC-anchored maths gives exactly 30.
    expect(nightsBetween("2026-10-20", "2026-11-19")).toBe(30)
  })
})

describe("datesInRange", () => {
  it("occupies [checkIn, checkOut) — the departure night is free", () => {
    // The single most consequential off-by-one in a booking system: including
    // the checkout night would block a room that is already sellable.
    expect(datesInRange("2026-08-12", "2026-08-15")).toEqual([
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
    ])
  })

  it("returns nothing for an empty or reversed range", () => {
    expect(datesInRange("2026-08-12", "2026-08-12")).toEqual([])
    expect(datesInRange("2026-08-15", "2026-08-12")).toEqual([])
  })
})

describe("addDays / daysBetween", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02")
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01")
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28")
  })

  it("measures signed distance", () => {
    expect(daysBetween("2026-08-12", "2026-08-15")).toBe(3)
    expect(daysBetween("2026-08-15", "2026-08-12")).toBe(-3)
  })
})

describe("isValidTimeOfDay", () => {
  it("accepts a 24-hour wall clock", () => {
    expect(isValidTimeOfDay("00:00")).toBe(true)
    expect(isValidTimeOfDay("15:00")).toBe(true)
    expect(isValidTimeOfDay("23:59")).toBe(true)
  })

  it("rejects out-of-range or malformed values", () => {
    expect(isValidTimeOfDay("24:00")).toBe(false)
    expect(isValidTimeOfDay("15:60")).toBe(false)
    expect(isValidTimeOfDay("3:00")).toBe(false)
  })
})

describe("zonedWallClockToInstant", () => {
  it("resolves the exact case the public policy page promises", () => {
    // "A 48-hour deadline for a 15:00 check-in in Tokyo expires at 15:00 Tokyo
    // time two days before." Tokyo is UTC+9 year-round.
    const instant = zonedWallClockToInstant("2026-08-12", "15:00", "Asia/Tokyo")
    expect(instant.toISOString()).toBe("2026-08-12T06:00:00.000Z")
  })

  it("applies daylight saving where the zone observes it", () => {
    // New York: EDT (UTC-4) in August, EST (UTC-5) in January.
    expect(
      zonedWallClockToInstant("2026-08-12", "15:00", "America/New_York").toISOString()
    ).toBe("2026-08-12T19:00:00.000Z")
    expect(
      zonedWallClockToInstant("2026-01-12", "15:00", "America/New_York").toISOString()
    ).toBe("2026-01-12T20:00:00.000Z")
  })

  it("handles a half-hour offset zone", () => {
    // Kathmandu is UTC+5:45 — the case that breaks integer-hour assumptions.
    expect(
      zonedWallClockToInstant("2026-08-12", "15:00", "Asia/Kathmandu").toISOString()
    ).toBe("2026-08-12T09:15:00.000Z")
  })

  it("resolves a wall clock on the day the clocks go forward", () => {
    // US DST starts 2026-03-08. 15:00 that day is already EDT (UTC-4); the
    // first-pass offset guess would be EST, which the second pass corrects.
    expect(
      zonedWallClockToInstant("2026-03-08", "15:00", "America/New_York").toISOString()
    ).toBe("2026-03-08T19:00:00.000Z")
  })

  it("rejects a bad wall clock or date", () => {
    expect(() => zonedWallClockToInstant("2026-08-12", "25:00", "Asia/Tokyo")).toThrow(TypeError)
    expect(() => zonedWallClockToInstant("2026-02-30", "15:00", "Asia/Tokyo")).toThrow(TypeError)
  })
})

describe("checkInInstant", () => {
  it("anchors the stay to the property's own clock", () => {
    // Two properties, same calendar date and check-in time, nine hours apart.
    const tokyo = checkInInstant({
      checkIn: "2026-08-12",
      checkInTime: "15:00",
      timezone: "Asia/Tokyo",
    })
    const newYork = checkInInstant({
      checkIn: "2026-08-12",
      checkInTime: "15:00",
      timezone: "America/New_York",
    })
    expect(newYork.getTime() - tokyo.getTime()).toBe(13 * 60 * 60 * 1000)
  })
})
