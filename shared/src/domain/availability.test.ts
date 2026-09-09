import { describe, expect, it } from "vitest"

import type { Occupancy } from "../types/common"
import type { RatePlanRate } from "../types/property"
import { makeInventory, makeNight, makeRate } from "./night.fixture"
import {
  alternativeRooms,
  checkAvailability,
  checkPropertyAvailability,
  checkStay,
  resolveNight,
  resolveStay,
  tightestNight,
  unitsLeft,
  withinBookingHorizon,
  type RoomCapacity,
} from "./availability"

/** Deluxe King: sleeps 2 adults, or 1 adult + 1 child. 28 of them. */
const room = { units: 28 }
const capacity: RoomCapacity = {
  name: "Deluxe King Room",
  maxAdults: 2,
  maxChildren: 1,
  maxOccupancy: 2,
}
const ratePlan = { basePrice: 72_500, defaultMinStay: 1, defaultMaxStay: null }

const party = (adults: number, children = 0): Occupancy => ({ adults, children })

const night = makeNight

describe("resolveNight", () => {
  it("falls back to room and plan defaults when neither calendar has a row", () => {
    // Both calendars are sparse — most nights have no row in either.
    expect(resolveNight("2026-08-12", { room, ratePlan })).toEqual(makeNight())
  })

  it("takes price and restrictions from the RATE PLAN calendar", () => {
    const rate = makeRate({ date: "2026-12-31", rate: 140_000, minStay: 3, minStayThrough: 2 })
    const resolved = resolveNight("2026-12-31", { room, ratePlan, rate })
    expect(resolved.rate).toBe(140_000)
    expect(resolved.minStay).toBe(3)
    expect(resolved.minStayThrough).toBe(2)
  })

  it("takes stock from the ROOM calendar", () => {
    const inventory = makeInventory({ date: "2026-12-31", bookedUnits: 27 })
    const resolved = resolveNight("2026-12-31", { room, ratePlan, inventory })
    expect(resolved.bookedUnits).toBe(27)
    // isClosed was null on the row → falls back to open
    expect(resolved.isClosed).toBe(false)
  })

  it("lets two rate plans price the same night differently off shared stock", () => {
    // The whole point of splitting the calendars: Flexible and Non-refundable
    // are different products sold out of the same 28 rooms.
    const inventory = makeInventory({ bookedUnits: 20 })
    const flexible = resolveNight("2026-08-12", {
      room,
      ratePlan: { basePrice: 72_500, defaultMinStay: 1, defaultMaxStay: null },
      inventory,
    })
    const nonRefundable = resolveNight("2026-08-12", {
      room,
      ratePlan: { basePrice: 62_000, defaultMinStay: 1, defaultMaxStay: null },
      inventory,
    })

    expect(flexible.rate).toBe(72_500)
    expect(nonRefundable.rate).toBe(62_000)
    // ...but the same stock, so they cannot oversell each other.
    expect(flexible.bookedUnits).toBe(nonRefundable.bookedUnits)
    expect(unitsLeft([flexible])).toBe(unitsLeft([nonRefundable]))
  })
})

describe("resolveStay", () => {
  it("resolves one night per stay night, excluding the departure date", () => {
    const nights = resolveStay("2026-08-12", "2026-08-15", { room, ratePlan })
    expect(nights.map((n) => n.date)).toEqual(["2026-08-12", "2026-08-13", "2026-08-14"])
  })

  it("applies sparse overrides only on the dates that have them", () => {
    const rates = new Map<string, RatePlanRate>([
      ["2026-08-13", makeRate({ date: "2026-08-13", rate: 90_000 })],
    ])
    const nights = resolveStay("2026-08-12", "2026-08-15", { room, ratePlan, rates })
    expect(nights.map((n) => n.rate)).toEqual([72_500, 90_000, 72_500])
  })

  it("returns nothing for a reversed range", () => {
    expect(resolveStay("2026-08-15", "2026-08-12", { room, ratePlan })).toEqual([])
  })
})

describe("checkStay", () => {
  it("rejects an empty stay", () => {
    expect(checkStay([])).toMatchObject({ ok: false, reason: "invalid_dates" })
  })

  it("enforces MinLOS on the arrival night", () => {
    expect(checkStay([night({ minStay: 3 }), night()])).toMatchObject({
      ok: false,
      reason: "min_stay",
    })
  })

  it("ignores a later night's MinLOS — it only applies on arrival", () => {
    expect(checkStay([night(), night({ minStay: 3 })])).toEqual({ ok: true })
  })

  it("enforces min_stay_through on every covered night (rule #26)", () => {
    // THE bypass this rule exists to close: a 3-night weekend minimum on
    // Friday, sidestepped by arriving Thursday where the minimum is 1.
    const thursday = night({ date: "2026-08-13", minStay: 1 })
    const friday = night({ date: "2026-08-14", minStay: 3, minStayThrough: 3 })
    expect(checkStay([thursday, friday])).toMatchObject({
      ok: false,
      reason: "min_stay_through",
    })
  })

  it("passes when the stay is long enough for the through-restriction", () => {
    expect(
      checkStay([
        night({ date: "2026-08-13", minStay: 1 }),
        night({ date: "2026-08-14", minStayThrough: 3 }),
        night({ date: "2026-08-15", minStayThrough: 3 }),
      ])
    ).toEqual({ ok: true })
  })

  it("rejects a stay that touches a closed night", () => {
    expect(checkStay([night(), night({ isClosed: true }), night()])).toMatchObject({
      ok: false,
      reason: "closed",
    })
  })

  /* ------------------------------------------------ restrictions (rule #33) */

  it("blocks a stay that BEGINS on a closed-to-arrival date", () => {
    // The classic Sunday CTA: the room may be occupied that night, just not
    // as the first night of a new stay.
    expect(checkStay([night({ closedToArrival: true }), night()])).toMatchObject({
      ok: false,
      reason: "closed_to_arrival",
    })
  })

  it("allows a stay that merely PASSES THROUGH a closed-to-arrival date", () => {
    expect(checkStay([night(), night({ closedToArrival: true })])).toEqual({ ok: true })
  })

  it("blocks a stay that ENDS on a closed-to-departure date", () => {
    // CTD applies to the CHECKOUT date, which is not one of the nights the
    // guest occupies — so it has to be passed in separately or it is missed.
    expect(
      checkStay([night(), night()], { departureNight: { closedToDeparture: true } })
    ).toMatchObject({ ok: false, reason: "closed_to_departure" })
  })

  it("ignores closed-to-departure on nights inside the stay", () => {
    expect(checkStay([night({ closedToDeparture: true }), night()])).toEqual({ ok: true })
  })

  it("enforces a maximum stay from the arrival night", () => {
    // A 30-night stay over a peak week blocks inventory that would sell far
    // better in three-night pieces.
    const long = Array.from({ length: 15 }, () => night({ maxStay: 14 }))
    expect(checkStay(long)).toMatchObject({ ok: false, reason: "max_stay" })
    expect(checkStay(long.slice(0, 14))).toEqual({ ok: true })
  })

  it("enforces minimum advance booking", () => {
    // A reservation landing ten minutes before arrival is a housekeeping
    // problem, not a theoretical one.
    const nights = [night({ minAdvanceHours: 24 }), night()]
    const checkInInstant = new Date("2026-08-12T19:00:00Z")

    expect(
      checkStay(nights, { now: new Date("2026-08-12T09:00:00Z"), checkInInstant })
    ).toMatchObject({ ok: false, reason: "too_late" })

    expect(
      checkStay(nights, { now: new Date("2026-08-10T09:00:00Z"), checkInInstant })
    ).toEqual({ ok: true })
  })

  it("skips the advance rule when the caller supplies no clock", () => {
    // The domain never reads a clock of its own — no context, no check.
    expect(checkStay([night({ minAdvanceHours: 24 }), night()])).toEqual({ ok: true })
  })

  it("reports the arrival rules before the length rules", () => {
    // "You cannot check in that day" is more actionable than "too short".
    const result = checkStay([night({ closedToArrival: true, minStay: 5 })])
    expect(result).toMatchObject({ reason: "closed_to_arrival" })
  })
})

describe("withinBookingHorizon (rule #34)", () => {
  it("accepts a stay inside 18 months", () => {
    expect(withinBookingHorizon("2027-08-01", "2026-08-19")).toBe(true)
  })

  it("rejects a stay beyond it", () => {
    // Without a horizon a guest can book 2050, and the calendar query has no
    // bound at all (API4).
    expect(withinBookingHorizon("2028-08-01", "2026-08-19")).toBe(false)
  })

  it("clamps month arithmetic rather than rolling over", () => {
    // 31 Aug + 18 months is 28 Feb, not 3 March.
    expect(withinBookingHorizon("2028-02-28", "2026-08-31")).toBe(true)
    expect(withinBookingHorizon("2028-03-01", "2026-08-31")).toBe(false)
  })
})

describe("unitsLeft", () => {
  it("takes the tightest night — one full night blocks the whole stay", () => {
    expect(
      unitsLeft([
        night({ date: "2026-08-12", bookedUnits: 27 }), // 1 left
        night({ date: "2026-08-13", bookedUnits: 28 }), // 0 left
        night({ date: "2026-08-14", bookedUnits: 26 }), // 2 left
      ])
    ).toBe(0)
  })

  it("counts against sellableUnits, not totalUnits (rule #25)", () => {
    // The day an overbooking allowance is switched on, only sellableUnits
    // moves — this is the line that reads it.
    expect(unitsLeft([night({ totalUnits: 28, sellableUnits: 30, bookedUnits: 28 })])).toBe(2)
  })

  it("never reports negative inventory", () => {
    expect(unitsLeft([night({ bookedUnits: 40 })])).toBe(0)
  })

  it("reports nothing for an empty stay", () => {
    expect(unitsLeft([])).toBe(0)
  })
})

describe("tightestNight", () => {
  it("names the night that is blocking the stay", () => {
    expect(
      tightestNight([
        night({ date: "2026-08-12", bookedUnits: 27 }),
        night({ date: "2026-08-13", bookedUnits: 28 }),
        night({ date: "2026-08-14", bookedUnits: 26 }),
      ])?.date
    ).toBe("2026-08-13")
  })

  it("returns null for an empty stay", () => {
    expect(tightestNight([])).toBeNull()
  })
})

describe("checkAvailability", () => {
  const nights3 = [night(), night(), night()]

  it("accepts a clean stay", () => {
    expect(checkAvailability({ nights: nights3, occupancy: party(2), room: capacity })).toEqual({
      ok: true,
    })
  })

  it("rejects too many adults, and says so", () => {
    const result = checkAvailability({ nights: nights3, occupancy: party(3), room: capacity })
    expect(result).toMatchObject({ ok: false, reason: "capacity" })
    if (!result.ok) expect(result.message).toContain("sleeps 2 adults")
  })

  it("rejects a party that exceeds total occupancy even within the adult limit", () => {
    // 2 adults + 1 child is 3 people in a room that sleeps 2 — the case a
    // single `guests` number could never catch on its own (rule #28).
    const result = checkAvailability({ nights: nights3, occupancy: party(2, 1), room: capacity })
    expect(result).toMatchObject({ ok: false, reason: "capacity" })
    if (!result.ok) expect(result.message).toContain("sleeps 2 guests in total")
  })

  it("accepts an adult and a child where the room allows it", () => {
    expect(
      checkAvailability({ nights: nights3, occupancy: party(1, 1), room: capacity })
    ).toEqual({ ok: true })
  })

  it("says plainly when a room takes no children at all", () => {
    const adultsOnly: RoomCapacity = { ...capacity, maxChildren: 0 }
    const result = checkAvailability({ nights: nights3, occupancy: party(1, 1), room: adultsOnly })
    if (!result.ok) expect(result.message).toContain("cannot accommodate children")
  })

  it("rejects when the tightest night is full", () => {
    const result = checkAvailability({
      nights: [night(), night({ bookedUnits: 28 })],
      occupancy: party(2),
      room: capacity,
    })
    expect(result).toMatchObject({ ok: false, reason: "sold_out" })
  })

  it("reports the calendar failure before the inventory one", () => {
    // A closed night is a clearer explanation than "fully booked".
    const result = checkAvailability({
      nights: [night({ isClosed: true, bookedUnits: 28 })],
      occupancy: party(2),
      room: capacity,
    })
    expect(result).toMatchObject({ ok: false, reason: "closed" })
  })

  it("uses singular wording for a single-adult room", () => {
    const single: RoomCapacity = {
      name: "Single Room",
      maxAdults: 1,
      maxChildren: 0,
      maxOccupancy: 1,
    }
    const result = checkAvailability({ nights: nights3, occupancy: party(2), room: single })
    if (!result.ok) expect(result.message).toContain("sleeps 1 adult.")
  })
})

describe("checkPropertyAvailability", () => {
  const standard: RoomCapacity = {
    name: "Standard Room",
    maxAdults: 2,
    maxChildren: 1,
    maxOccupancy: 2,
  }
  const premium: RoomCapacity = {
    name: "Premium King Room",
    maxAdults: 3,
    maxChildren: 2,
    maxOccupancy: 3,
  }

  it("passes when any one room type is bookable", () => {
    expect(
      checkPropertyAvailability(
        [
          { room: standard, nights: [night({ bookedUnits: 28 })] },
          { room: premium, nights: [night()] },
        ],
        party(2)
      )
    ).toEqual({ ok: true })
  })

  it("fails when every room type fails", () => {
    expect(
      checkPropertyAvailability(
        [
          { room: standard, nights: [night({ bookedUnits: 28 })] },
          { room: premium, nights: [night({ bookedUnits: 28 })] },
        ],
        party(2)
      )
    ).toMatchObject({ ok: false, reason: "sold_out" })
  })

  it("fails a property with no rooms at all", () => {
    expect(checkPropertyAvailability([], party(2))).toMatchObject({
      ok: false,
      reason: "sold_out",
    })
  })
})

describe("alternativeRooms", () => {
  it("offers the rooms a guest can still take after losing theirs (rule #24)", () => {
    const candidates = [
      {
        id: "deluxe",
        room: { name: "Deluxe King", maxAdults: 2, maxChildren: 1, maxOccupancy: 2 },
        nights: [night({ bookedUnits: 28 })],
      },
      {
        id: "standard",
        room: { name: "Standard", maxAdults: 2, maxChildren: 1, maxOccupancy: 2 },
        nights: [night()],
      },
      {
        id: "single",
        room: { name: "Single", maxAdults: 1, maxChildren: 0, maxOccupancy: 1 },
        nights: [night()],
      },
    ]

    const offered = alternativeRooms(
      candidates,
      { occupancy: party(2), exclude: new Set(["deluxe"]) },
      (c) => c.id
    )

    // Deluxe excluded (the one they just lost), single too small.
    expect(offered.map((c) => c.id)).toEqual(["standard"])
  })

  it("returns nothing when there is genuinely nothing left", () => {
    const candidates = [
      {
        id: "a",
        room: { name: "A", maxAdults: 2, maxChildren: 0, maxOccupancy: 2 },
        nights: [night({ bookedUnits: 28 })],
      },
    ]
    expect(alternativeRooms(candidates, { occupancy: party(2) }, (c) => c.id)).toEqual([])
  })
})
