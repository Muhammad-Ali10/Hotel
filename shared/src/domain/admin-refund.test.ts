import { describe, expect, it } from "vitest"

import {
  adminRefundRejection,
  planAdminRefund,
  refundStatusAfter,
  type AdminRefundInput,
} from "./admin-refund"

/** A prepaid $1000 stay, 15% commission, guest entitled to half back. */
const base: AdminRefundInput = {
  captured: 100_000,
  alreadyRefunded: 0,
  entitled: 50_000,
  commission: 15_000,
  amount: 50_000,
}

describe("adminRefundRejection (rule #76)", () => {
  it("allows a refund within what was captured", () => {
    expect(adminRefundRejection(base)).toBeNull()
  })

  /*
   * The ceiling is what was CAPTURED, never `bookings.total`. On a guarantee
   * rate the guest may have paid the platform nothing at all, and refunding
   * against the total would send out money that never came in.
   */
  it("refuses when nothing was ever captured", () => {
    expect(adminRefundRejection({ ...base, captured: 0 })).toBe("nothing_captured")
  })

  it("refuses when everything captured has already gone back", () => {
    expect(adminRefundRejection({ ...base, alreadyRefunded: 100_000 })).toBe("nothing_captured")
  })

  it("refuses more than is left to refund", () => {
    expect(adminRefundRejection({ ...base, amount: 100_001 })).toBe("exceeds_captured")
    expect(adminRefundRejection({ ...base, alreadyRefunded: 60_000, amount: 40_001 })).toBe(
      "exceeds_captured"
    )
  })

  it("allows exactly the remainder", () => {
    expect(adminRefundRejection({ ...base, alreadyRefunded: 60_000, amount: 40_000 })).toBeNull()
  })

  it("refuses a zero or negative refund", () => {
    expect(adminRefundRejection({ ...base, amount: 0 })).toBe("not_positive")
    expect(adminRefundRejection({ ...base, amount: -1 })).toBe("not_positive")
  })
})

describe("planAdminRefund (rule #76)", () => {
  it("takes nothing from the platform when the refund is what the guest was owed", () => {
    const plan = planAdminRefund(base)
    expect(plan).toMatchObject({
      refund: 50_000,
      goodwill: 0,
      voidsCommission: false,
      commissionGivenUp: 0,
    })
  })

  it("gives up the commission the moment any part is goodwill", () => {
    const plan = planAdminRefund({ ...base, amount: 60_000 })
    expect(plan).toMatchObject({
      refund: 60_000,
      goodwill: 10_000,
      voidsCommission: true,
      commissionGivenUp: 15_000,
    })
  })

  /*
   * Not proportional. A property must not lose money on a decision it was not
   * part of, and the platform giving up "most of" its commission would still
   * leave the property paying for somebody else's goodwill.
   */
  it("gives up the WHOLE commission, not a share of it", () => {
    const plan = planAdminRefund({ ...base, amount: 50_001 })
    expect(plan.goodwill).toBe(1)
    expect(plan.commissionGivenUp).toBe(15_000)
  })

  /*
   * The entitlement is an allowance, and it can only be spent once. A second
   * refund on a booking that already paid out its entitlement is goodwill in
   * full.
   */
  it("does not let the same entitlement be spent twice", () => {
    const plan = planAdminRefund({ ...base, alreadyRefunded: 50_000, amount: 20_000 })
    expect(plan.goodwill).toBe(20_000)
    expect(plan.voidsCommission).toBe(true)
  })

  it("counts a partial entitlement already paid", () => {
    // Owed $500, $200 already back, refunding $400 → $100 of it is goodwill.
    const plan = planAdminRefund({ ...base, alreadyRefunded: 20_000, amount: 40_000 })
    expect(plan.goodwill).toBe(10_000)
  })

  it("knows when everything captured has gone back", () => {
    expect(planAdminRefund({ ...base, amount: 100_000 }).isFull).toBe(true)
    expect(planAdminRefund({ ...base, alreadyRefunded: 40_000, amount: 60_000 }).isFull).toBe(true)
    expect(planAdminRefund({ ...base, amount: 99_999 }).isFull).toBe(false)
  })

  it("treats a booking with no entitlement as goodwill throughout", () => {
    const plan = planAdminRefund({ ...base, entitled: 0, amount: 30_000 })
    expect(plan.goodwill).toBe(30_000)
    expect(plan.voidsCommission).toBe(true)
  })
})

describe("refundStatusAfter", () => {
  it("says full when nothing captured is left", () => {
    expect(refundStatusAfter(planAdminRefund({ ...base, amount: 100_000 }))).toBe("full")
  })

  it("says partial otherwise", () => {
    expect(refundStatusAfter(planAdminRefund(base))).toBe("partial")
  })

  /*
   * `processed` is the provider's word and arrives later on a webhook (rule
   * #45). Saying it here would be this API guessing at something it has not
   * been told.
   */
  it("never claims the money has actually landed", () => {
    for (const amount of [1, 50_000, 100_000]) {
      expect(["full", "partial"]).toContain(
        refundStatusAfter(planAdminRefund({ ...base, amount }))
      )
    }
  })
})
