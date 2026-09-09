import { describe, expect, it } from "vitest"

import type { BookingActor, BookingStatus } from "../types/booking"
import {
  TRANSITIONS,
  canTransition,
  guestName,
  holdsInventory,
  isHoldExpired,
  isInHouse,
  isTerminal,
  isUpcoming,
} from "./booking-status"

const ALL: BookingStatus[] = [
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
]

describe("TRANSITIONS", () => {
  it("matches rule #6 exactly", () => {
    expect(TRANSITIONS).toEqual({
      pending: ["confirmed", "cancelled"],
      confirmed: ["checked_in", "no_show", "cancelled"],
      checked_in: ["completed"],
      completed: [],
      cancelled: [],
      no_show: [],
    })
  })

  it("has no `checked_out` anywhere — it was merged into `completed`", () => {
    expect(Object.keys(TRANSITIONS)).not.toContain("checked_out")
  })
})

describe("isTerminal", () => {
  it("marks the three end states", () => {
    expect(isTerminal("completed")).toBe(true)
    expect(isTerminal("cancelled")).toBe(true)
    expect(isTerminal("no_show")).toBe(true)
    expect(isTerminal("pending")).toBe(false)
  })
})

describe("canTransition", () => {
  const partnerAdmin: BookingActor = "partner_admin"

  it("allows every transition rule #6 lists", () => {
    expect(canTransition("pending", "confirmed", partnerAdmin)).toEqual({ ok: true })
    expect(canTransition("confirmed", "checked_in", partnerAdmin)).toEqual({ ok: true })
    expect(canTransition("confirmed", "no_show", partnerAdmin)).toEqual({ ok: true })
    expect(canTransition("checked_in", "completed", partnerAdmin)).toEqual({ ok: true })
    expect(canTransition("confirmed", "cancelled", "guest")).toEqual({ ok: true })
  })

  it("refuses to resurrect a cancelled booking", () => {
    // The prototype allowed exactly this — setBookingStatus had no guards.
    const result = canTransition("cancelled", "confirmed", partnerAdmin)
    expect(result).toMatchObject({ ok: false, reason: "terminal" })
  })

  it("refuses to complete a stay that was never checked in", () => {
    expect(canTransition("confirmed", "completed", partnerAdmin)).toMatchObject({
      ok: false,
      reason: "not_allowed",
    })
  })

  it("refuses to cancel a stay in progress", () => {
    expect(canTransition("checked_in", "cancelled", partnerAdmin)).toMatchObject({
      ok: false,
      reason: "not_allowed",
    })
  })

  it("refuses a no-op", () => {
    expect(canTransition("confirmed", "confirmed", partnerAdmin)).toMatchObject({
      ok: false,
      reason: "not_allowed",
    })
  })

  it("reports an impossible move as impossible, not as a permission problem", () => {
    // Actor is irrelevant when the transition itself does not exist.
    expect(canTransition("completed", "checked_in", "guest")).toMatchObject({ reason: "terminal" })
  })

  it("lets staff check in and complete, but not cancel or mark no-show (rule #14)", () => {
    expect(canTransition("confirmed", "checked_in", "partner_staff")).toEqual({ ok: true })
    expect(canTransition("checked_in", "completed", "partner_staff")).toEqual({ ok: true })
    expect(canTransition("confirmed", "cancelled", "partner_staff")).toMatchObject({
      ok: false,
      reason: "forbidden",
    })
    expect(canTransition("confirmed", "no_show", "partner_staff")).toMatchObject({
      ok: false,
      reason: "forbidden",
    })
  })

  it("lets a guest cancel but nothing else", () => {
    expect(canTransition("pending", "cancelled", "guest")).toEqual({ ok: true })
    expect(canTransition("confirmed", "checked_in", "guest")).toMatchObject({
      ok: false,
      reason: "forbidden",
    })
    expect(canTransition("confirmed", "no_show", "guest")).toMatchObject({
      ok: false,
      reason: "forbidden",
    })
  })

  it("lets the cron expire a hold and close a forgotten stay", () => {
    expect(canTransition("pending", "cancelled", "system")).toEqual({ ok: true })
    expect(canTransition("checked_in", "completed", "system")).toEqual({ ok: true })
    // ...but the cron must never decide somebody was a no-show.
    expect(canTransition("confirmed", "no_show", "system")).toMatchObject({
      ok: false,
      reason: "forbidden",
    })
  })

  it("lets a platform admin make every listed move", () => {
    for (const from of ALL) {
      for (const to of TRANSITIONS[from]) {
        expect(canTransition(from, to, "platform_admin")).toEqual({ ok: true })
      }
    }
  })

  it("rejects every transition that is not listed, for every actor", () => {
    const actors: BookingActor[] = ["guest", "partner_admin", "platform_admin", "system"]
    for (const from of ALL) {
      for (const to of ALL) {
        if (from === to || TRANSITIONS[from].includes(to)) continue
        for (const actor of actors) {
          expect(canTransition(from, to, actor).ok).toBe(false)
        }
      }
    }
  })
})

describe("holdsInventory", () => {
  it("holds a room for anything that is not cancelled or finished", () => {
    expect(holdsInventory("pending")).toBe(true)
    expect(holdsInventory("confirmed")).toBe(true)
    expect(holdsInventory("checked_in")).toBe(true)
    // The guest never came, but the nights could not be resold either.
    expect(holdsInventory("no_show")).toBe(true)
  })

  it("releases the room when cancelled", () => {
    expect(holdsInventory("cancelled")).toBe(false)
  })

  it("does not hold anything once the stay is over", () => {
    expect(holdsInventory("completed")).toBe(false)
  })
})

describe("isHoldExpired", () => {
  const now = new Date("2026-08-01T12:00:00Z")

  it("expires a pending hold whose window has passed", () => {
    expect(
      isHoldExpired({ status: "pending", holdExpiresAt: "2026-08-01T11:45:00Z" }, now)
    ).toBe(true)
  })

  it("keeps a hold that is still live", () => {
    expect(
      isHoldExpired({ status: "pending", holdExpiresAt: "2026-08-01T12:15:00Z" }, now)
    ).toBe(false)
  })

  it("ignores bookings that are not pending", () => {
    // A confirmed booking has no hold to expire, whatever the column says.
    expect(
      isHoldExpired({ status: "confirmed", holdExpiresAt: "2026-01-01T00:00:00Z" }, now)
    ).toBe(false)
  })

  it("ignores a pending booking with no expiry set", () => {
    expect(isHoldExpired({ status: "pending", holdExpiresAt: null }, now)).toBe(false)
  })
})

describe("helpers", () => {
  it("builds a guest name without stray spaces", () => {
    expect(guestName({ firstName: "John", lastName: "Doe" })).toBe("John Doe")
    expect(guestName({ firstName: "John", lastName: "" })).toBe("John")
  })

  it("counts only live, future stays as upcoming", () => {
    const today = "2026-08-01"
    expect(isUpcoming({ status: "confirmed", checkIn: "2026-08-12" }, today)).toBe(true)
    expect(isUpcoming({ status: "pending", checkIn: "2026-08-12" }, today)).toBe(true)
    expect(isUpcoming({ status: "cancelled", checkIn: "2026-08-12" }, today)).toBe(false)
    expect(isUpcoming({ status: "confirmed", checkIn: "2026-07-30" }, today)).toBe(false)
    expect(isUpcoming({ status: "completed", checkIn: "2026-08-12" }, today)).toBe(false)
  })

  it("knows when a guest is in the building", () => {
    expect(isInHouse({ status: "checked_in" })).toBe(true)
    expect(isInHouse({ status: "confirmed" })).toBe(false)
  })
})
