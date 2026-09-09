import { describe, expect, it } from "vitest"

import {
  DEFAULT_COMMISSION_BPS,
  commissionFor,
  commissionStatusFor,
  defaultCommissionBps,
  isPayable,
  partnerPayout,
} from "./commission"

describe("commissionFor", () => {
  it("computes 15% of the reference booking to the cent", () => {
    // $2,432.00 × 15% = $364.80 — the figure a dollars-based ledger rounded to
    // $365 and lost $0.20 on, every booking.
    expect(commissionFor(243_200, 1500)).toBe(36_480)
  })

  it("expresses a negotiated half-percent exactly", () => {
    expect(commissionFor(243_200, 1250)).toBe(30_400) // 12.5%
  })

  it("returns nothing on a zero total", () => {
    expect(commissionFor(0, 1500)).toBe(0)
  })
})

describe("plan tier defaults", () => {
  it("charges less as the plan gets bigger", () => {
    expect(DEFAULT_COMMISSION_BPS.starter).toBeGreaterThan(DEFAULT_COMMISSION_BPS.professional)
    expect(DEFAULT_COMMISSION_BPS.professional).toBeGreaterThan(DEFAULT_COMMISSION_BPS.enterprise)
  })

  it("resolves a tier to its rate", () => {
    expect(defaultCommissionBps("starter")).toBe(1800)
    expect(defaultCommissionBps("professional")).toBe(1500)
    expect(defaultCommissionBps("enterprise")).toBe(1200)
  })
})

describe("commissionStatusFor", () => {
  it("earns commission only on a completed stay (rule #9)", () => {
    expect(commissionStatusFor("completed")).toBe("earned")
  })

  it("voids it when the guest never stayed", () => {
    // What the property keeps from a cancellation is compensation for a room
    // it held and could not resell — not revenue to take a cut of.
    expect(commissionStatusFor("cancelled")).toBe("void")
    expect(commissionStatusFor("no_show")).toBe("void")
  })

  it("holds it undecided while the booking is live", () => {
    expect(commissionStatusFor("pending")).toBe("pending")
    expect(commissionStatusFor("confirmed")).toBe("pending")
    expect(commissionStatusFor("checked_in")).toBe("pending")
  })
})

describe("payout", () => {
  it("leaves the property with the rest", () => {
    const total = 243_200
    const commission = commissionFor(total, 1500)
    expect(partnerPayout(total, commission)).toBe(206_720) // $2,067.20
  })

  it("pays out only earned commission", () => {
    expect(isPayable("earned")).toBe(true)
    expect(isPayable("pending")).toBe(false)
    // Voided amounts stay on the booking for reporting, but are never charged.
    expect(isPayable("void")).toBe(false)
  })
})
