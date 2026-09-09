import { describe, expect, it } from "vitest"

import type { PaymentStatus } from "../types/payment"
import { PAYMENT_STATUSES } from "../types/payment"
import { refundFor } from "./cancellation"
import {
  HOLD_MINUTES,
  canTransitionPayment,
  intentFor,
  isModeAllowed,
  isPaymentTerminal,
  refundableAmount,
  settlementFor,
  settles,
  statusAfterRefund,
} from "./payments"

describe("isModeAllowed", () => {
  it("refuses a non-refundable rate that takes no money up front", () => {
    // The rate that gives up the right to cancel is exactly the one that has
    // to be paid for: a guarantee would promise the property the money and
    // then hold nothing but a verified card.
    expect(isModeAllowed("guarantee", { freeUntil: "non_refundable" })).toBe(false)
    expect(isModeAllowed("prepay", { freeUntil: "non_refundable" })).toBe(true)
  })

  it("allows either mode on every refundable policy", () => {
    for (const freeUntil of ["6pm_arrival", "24h", "48h", "7d", "14d"] as const) {
      expect(isModeAllowed("guarantee", { freeUntil })).toBe(true)
      expect(isModeAllowed("prepay", { freeUntil })).toBe(true)
    }
  })
})

describe("intentFor", () => {
  it("charges the whole total on a prepay rate", () => {
    expect(intentFor("prepay", 217_500)).toEqual({ kind: "charge", amount: 217_500 })
  })

  it("moves nothing on a guarantee — the card is proved, not charged", () => {
    expect(intentFor("guarantee", 217_500)).toEqual({ kind: "guarantee", amount: 0 })
  })
})

describe("canTransitionPayment", () => {
  it("walks a prepay from intent to captured", () => {
    expect(canTransitionPayment("requires_payment_method", "requires_action").ok).toBe(true)
    expect(canTransitionPayment("requires_action", "captured").ok).toBe(true)
  })

  it("leaves a guarantee sitting on authorized for the whole stay", () => {
    expect(canTransitionPayment("requires_payment_method", "authorized").ok).toBe(true)
    // And it can still be captured later — that is the no-show charge.
    expect(canTransitionPayment("authorized", "captured").ok).toBe(true)
  })

  it("never un-captures a payment", () => {
    // Money that moved has to move back through a refund, which is its own
    // row. Rewinding the status instead would lose the fact that it happened.
    for (const to of ["requires_payment_method", "requires_action", "authorized"] as const) {
      expect(canTransitionPayment("captured", to).ok).toBe(false)
    }
  })

  it("refuses to move anything out of a terminal state", () => {
    for (const from of ["refunded", "failed", "cancelled"] as const) {
      for (const to of PAYMENT_STATUSES) {
        expect(canTransitionPayment(from, to).ok).toBe(false)
      }
    }
  })

  it("refuses a repeat of the state it is already in", () => {
    // A retried webhook must not look like a second capture.
    for (const status of PAYMENT_STATUSES) {
      expect(canTransitionPayment(status, status).ok).toBe(false)
    }
  })

  it("agrees with isPaymentTerminal", () => {
    for (const status of PAYMENT_STATUSES) {
      const anyMoveOut = PAYMENT_STATUSES.some((to) => canTransitionPayment(status, to).ok)
      expect(isPaymentTerminal(status)).toBe(!anyMoveOut)
    }
  })
})

describe("settles", () => {
  it("needs a capture on prepay and an authorization on guarantee", () => {
    expect(settles("prepay", "captured")).toBe(true)
    // An authorization is not the money; a prepay rate promised the money.
    expect(settles("prepay", "authorized")).toBe(false)

    expect(settles("guarantee", "authorized")).toBe(true)
  })

  it("keeps a guarantee settled after its card has been charged", () => {
    // A no-show fee captures the same card. That is strictly more settled than
    // an authorization — reading it as unsettled would let a later re-check
    // un-confirm a stay that already happened.
    expect(settles("guarantee", "captured")).toBe(true)
  })

  it("confirms a booking on nothing else", () => {
    const unsettling: PaymentStatus[] = [
      "requires_payment_method",
      "requires_action",
      "failed",
      "cancelled",
      "refunded",
    ]
    for (const status of unsettling) {
      expect(settles("prepay", status)).toBe(false)
      expect(settles("guarantee", status)).toBe(false)
    }
  })
})

describe("refundableAmount", () => {
  it("is the untouched remainder of a captured payment", () => {
    expect(refundableAmount({ status: "captured", amount: 100_000, amountRefunded: 0 })).toBe(100_000)
    expect(
      refundableAmount({ status: "partially_refunded", amount: 100_000, amountRefunded: 40_000 })
    ).toBe(60_000)
  })

  it("is zero once everything has gone back", () => {
    expect(
      refundableAmount({ status: "partially_refunded", amount: 100_000, amountRefunded: 100_000 })
    ).toBe(0)
  })

  it("never goes negative when the ledger has been over-credited", () => {
    // A double-refund race or a replayed webhook. The provider would refuse the
    // second one — but only after we had already written it down.
    expect(
      refundableAmount({ status: "captured", amount: 100_000, amountRefunded: 150_000 })
    ).toBe(0)
  })

  it("is zero for money that never moved", () => {
    for (const status of ["authorized", "requires_action", "failed", "cancelled"] as const) {
      expect(refundableAmount({ status, amount: 100_000, amountRefunded: 0 })).toBe(0)
    }
  })
})

describe("statusAfterRefund", () => {
  it("is partial until the last cent is back", () => {
    expect(statusAfterRefund({ amount: 100_000 }, 99_999)).toBe("partially_refunded")
    expect(statusAfterRefund({ amount: 100_000 }, 100_000)).toBe("refunded")
  })
})

describe("settlementFor", () => {
  const total = 217_500

  it("sends money back on a prepaid cancellation", () => {
    // Cancelled inside the free window: they paid, so all of it returns.
    expect(settlementFor({ mode: "prepay", refund: total, charged: 0 })).toEqual({
      action: "refund",
      amount: total,
    })
  })

  it("charges the saved card on a guaranteed cancellation", () => {
    // The same policy, the opposite operation: nothing was taken, so the
    // penalty is the only money that ever moves.
    expect(settlementFor({ mode: "guarantee", refund: total, charged: 0 })).toEqual({
      action: "none",
      amount: 0,
    })
    expect(settlementFor({ mode: "guarantee", refund: 108_750, charged: 108_750 })).toEqual({
      action: "charge_penalty",
      amount: 108_750,
    })
  })

  it("moves nothing when a prepaid booking keeps the whole penalty", () => {
    expect(settlementFor({ mode: "prepay", refund: 0, charged: total })).toEqual({
      action: "none",
      amount: 0,
    })
  })

  it("settles a real policy in opposite directions, to the same cent", () => {
    // The one property that must hold: whatever rule #1 decides, the guest is
    // out the same amount and the property keeps the same amount, whichever
    // mode the rate plan used.
    const breakdown = refundFor({
      policy: { freeUntil: "48h", charge: "percent", chargeValue: 50 },
      pricing: {
        roomSubtotal: total,
        addOnsTotal: 0,
        nightlyRates: [72_500, 72_500, 72_500],
        total,
      },
      checkIn: "2026-09-10",
      checkInTime: "15:00",
      timezone: "America/New_York",
      // Inside 48h of arrival — the penalty applies.
      cancelledAt: new Date("2026-09-09T12:00:00.000Z"),
    })

    const prepaid = settlementFor({ mode: "prepay", ...breakdown })
    const guaranteed = settlementFor({ mode: "guarantee", ...breakdown })

    expect(prepaid).toEqual({ action: "refund", amount: breakdown.refund })
    expect(guaranteed).toEqual({ action: "charge_penalty", amount: breakdown.charged })
    // Whichever way round, the property keeps exactly `charged`.
    expect(total - prepaid.amount).toBe(guaranteed.amount)
  })
})

describe("HOLD_MINUTES", () => {
  it("is the documented 15 minutes (rule #44)", () => {
    expect(HOLD_MINUTES).toBe(15)
  })
})
