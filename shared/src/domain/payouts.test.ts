import { describe, expect, it } from "vitest"

import type { ISODate } from "../types/common"
import { commissionFor } from "./commission"
import {
  PAYOUT_HOLD_DAYS,
  PAYOUT_MINIMUM,
  isReleasable,
  lineFor,
  meetsMinimum,
  periodFor,
  periodToPayOn,
  summarise,
} from "./payouts"

const line = (over: Partial<Parameters<typeof lineFor>[0]> = {}) =>
  lineFor({
    bookingId: "b1",
    captured: 217_500,
    refunded: 0,
    commissionAmount: 32_625,
    commissionStatus: "earned",
    // The defaults: the guest paid the platform, and the platform holds the
    // commission back. Anything else is spelled out by the test that means it.
    paymentMode: "prepay",
    settlementMode: "deduct",
    ...over,
  })

describe("periodFor", () => {
  it("splits the month at the 16th", () => {
    expect(periodFor("2026-09-01" as ISODate)).toEqual({
      start: "2026-09-01",
      end: "2026-09-15",
      runsOn: "2026-09-16",
    })
    expect(periodFor("2026-09-15" as ISODate)).toMatchObject({ end: "2026-09-15" })
    expect(periodFor("2026-09-16" as ISODate)).toEqual({
      start: "2026-09-16",
      end: "2026-09-30",
      runsOn: "2026-10-01",
    })
  })

  it("lets the second half absorb whatever length the month is", () => {
    // The whole reason for calendar halves rather than a rolling fortnight:
    // the dates never drift, and February simply has a shorter second half.
    expect(periodFor("2026-02-20" as ISODate)).toMatchObject({
      start: "2026-02-16",
      end: "2026-02-28",
      runsOn: "2026-03-01",
    })
    expect(periodFor("2028-02-20" as ISODate)).toMatchObject({
      // 2028 is a leap year.
      end: "2028-02-29",
      runsOn: "2028-03-01",
    })
    expect(periodFor("2026-01-31" as ISODate)).toMatchObject({ end: "2026-01-31" })
  })

  it("rolls the year over in December", () => {
    expect(periodFor("2026-12-20" as ISODate)).toEqual({
      start: "2026-12-16",
      end: "2026-12-31",
      runsOn: "2027-01-01",
    })
  })

  it("pays out the period that just closed", () => {
    // A run on the 16th settles the 1st–15th, not the half it is standing in.
    expect(periodToPayOn("2026-09-16" as ISODate)).toMatchObject({
      start: "2026-09-01",
      end: "2026-09-15",
    })
    expect(periodToPayOn("2026-10-01" as ISODate)).toMatchObject({
      start: "2026-09-16",
      end: "2026-09-30",
    })
  })
})

describe("isReleasable", () => {
  const booking = (commissionStatus: string, checkOut: string) => ({
    commissionStatus,
    checkOut: checkOut as ISODate,
  })

  it("holds the money for seven days after checkout (rule #49)", () => {
    expect(isReleasable(booking("earned", "2026-09-01"), "2026-09-07" as ISODate)).toBe(false)
    expect(isReleasable(booking("earned", "2026-09-01"), "2026-09-08" as ISODate)).toBe(true)
  })

  it("uses the documented hold length", () => {
    expect(PAYOUT_HOLD_DAYS).toBe(7)
  })

  it("waits for a stay whose outcome is not settled", () => {
    // Still `confirmed` or `checked_in`: nobody knows yet whether the platform
    // earned anything, so nothing may leave.
    expect(isReleasable(booking("pending", "2026-09-01"), "2026-12-01" as ISODate)).toBe(false)
  })

  it("still releases a booking whose commission was voided", () => {
    // The point that is easy to get wrong. No commission was earned — but the
    // platform may be holding a cancellation penalty it took on the property's
    // behalf, and that money is theirs. Filtering on `earned` would keep it
    // forever.
    expect(isReleasable(booking("void", "2026-09-01"), "2026-09-08" as ISODate)).toBe(true)
  })
})

describe("lineFor", () => {
  it("pays out what was collected, less the commission", () => {
    expect(line()).toEqual({
      bookingId: "b1",
      gross: 217_500,
      commission: 32_625,
      billed: 0,
      net: 184_875,
    })
  })

  it("nets a partial refund out of the gross", () => {
    // The ledger and the booking total disagree here, and the ledger is what
    // the bank agrees with.
    expect(line({ refunded: 100_000 })).toMatchObject({ gross: 117_500, net: 84_875 })
  })

  it("takes no commission on a stay that did not happen (rule #9)", () => {
    // A late cancellation: the platform holds the penalty, but earned nothing.
    // The whole penalty is the property's.
    expect(line({ captured: 108_750, commissionStatus: "void" })).toEqual({
      bookingId: "b1",
      gross: 108_750,
      commission: 0,
      // Nothing was earned, so there is nothing to bill either.
      billed: 0,
      net: 108_750,
    })
  })

  /*
   * Rule #52, unchanged: the guest paid the property at the desk, so the
   * platform collected nothing while the commission was still earned. The
   * money flows the other way, and the partner's prepaid bookings in the same
   * cycle absorb it.
   *
   * What rules #91–#94 changed is only what happens when the WHOLE cycle
   * cannot absorb it — that shortfall becomes a monthly invoice with a period
   * and a due date, instead of a payout run reporting a negative number.
   */
  it("goes NEGATIVE on a guaranteed stay so the cycle can net it", () => {
    expect(line({ captured: 0, paymentMode: "guarantee" })).toEqual({
      bookingId: "b1",
      gross: 0,
      commission: 32_625,
      billed: 0,
      net: -32_625,
    })
  })

  it("pays out everything and bills later for an invoice org", () => {
    expect(line({ settlementMode: "invoice" })).toEqual({
      bookingId: "b1",
      gross: 217_500,
      commission: 0,
      billed: 32_625,
      net: 217_500,
    })
  })

  it("never deducts and bills the same commission twice", () => {
    for (const settlementMode of ["deduct", "invoice"] as const) {
      for (const paymentMode of ["prepay", "guarantee"] as const) {
        const result = line({ settlementMode, paymentMode, captured: paymentMode === "guarantee" ? 0 : 217_500 })
        expect(result.commission === 0 || result.billed === 0).toBe(true)
        expect(result.commission + result.billed).toBe(32_625)
      }
    }
  })

  it("never lets an over-refunded booking report negative gross", () => {
    // A double refund or a replayed webhook. `gross` is what is HELD, and you
    // cannot hold less than nothing — the discrepancy belongs in the ledger,
    // not in a payout line that would silently claw back an unrelated stay.
    expect(line({ captured: 100_000, refunded: 150_000 })).toMatchObject({ gross: 0 })
  })
})

describe("summarise", () => {
  it("pays out when the balance clears the minimum", () => {
    const result = summarise([line(), line()])
    expect(result).toMatchObject({
      gross: 435_000,
      commission: 65_250,
      net: 369_750,
      direction: "payout",
      bookingCount: 2,
    })
  })

  it("carries a balance too small to be worth the fee (rule #50)", () => {
    const small = summarise([line({ captured: 5_000, commissionAmount: 750 })])
    expect(small.net).toBe(4_250)
    expect(small.direction).toBe("carry")
    expect(meetsMinimum(small.net)).toBe(false)
  })

  it("accumulates the carried balance until it is worth paying", () => {
    // Without `carryIn` a property earning $60 a fortnight would carry forever
    // and never once be paid.
    const first = summarise([line({ captured: 5_000, commissionAmount: 750 })])
    const second = summarise([line({ captured: 5_000, commissionAmount: 750 })], first.net)
    const third = summarise([line({ captured: 5_000, commissionAmount: 750 })], second.net)

    expect(second.direction).toBe("carry")
    expect(third.net).toBe(12_750)
    expect(third.direction).toBe("payout")
  })

  it("invoices a property whose guests all paid at the desk (rule #52)", () => {
    const result = summarise([line({ captured: 0 }), line({ captured: 0 })])
    expect(result.net).toBe(-65_250)
    expect(result.direction).toBe("invoice")
  })

  it("nets the two modes against each other in one cycle", () => {
    // The ordinary case for a real property: some rates prepaid, some
    // guaranteed. One balance, one transfer.
    const result = summarise([line(), line({ captured: 0 })])
    expect(result.net).toBe(184_875 - 32_625)
    expect(result.direction).toBe("payout")
  })

  it("reports nothing when the balance is exactly zero", () => {
    expect(summarise([]).direction).toBe("none")
    expect(summarise([line({ captured: 32_625 })]).direction).toBe("none")
  })

  it("sits exactly on the minimum as a payout, not a carry", () => {
    const exact = summarise([line({ captured: PAYOUT_MINIMUM, commissionAmount: 0, commissionStatus: "void" })])
    expect(exact.net).toBe(PAYOUT_MINIMUM)
    expect(exact.direction).toBe("payout")
  })

  it("agrees with commissionFor on the rate it charges", () => {
    // One definition of what 15% of a booking is, used by the booking flow and
    // by the payout run alike.
    const total = 217_500
    const commission = commissionFor(total, 1500)
    expect(line({ captured: total, commissionAmount: commission }).net).toBe(total - commission)
    expect(commission).toBe(32_625)
  })
})
