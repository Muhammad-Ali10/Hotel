import { describe, expect, it } from "vitest"

import {
  collectionFor,
  INVOICE_DUE_DAYS,
  isOverdue,
  OVERDUE_CONSEQUENCE,
  summariseInvoice,
} from "./settlement-mode"

/** A $1,000 stay at 20% — the example the model was described with. */
/**
 * A $1,000 prepaid stay at 20%.
 *
 * `gross` is what the PLATFORM holds — so the guarantee cases below pass `0`,
 * because nothing reached it.
 */
const stay = { gross: 100_000, commission: 20_000 }

describe("collectionFor (rules #91–#93)", () => {
  describe("prepay — the platform is holding the money", () => {
    it("holds the commission back and pays the rest", () => {
      expect(collectionFor({ ...stay, mode: "deduct", paymentMode: "prepay" })).toEqual({
        collect: "deducted",
        payout: 80_000,
        billed: 0,
      })
    })

    it("sends everything and bills later when the org is on invoice", () => {
      expect(collectionFor({ ...stay, mode: "invoice", paymentMode: "prepay" })).toEqual({
        collect: "billed",
        payout: 100_000,
        billed: 20_000,
      })
    })

    /*
     * The whole risk in one assertion. On `invoice` the platform hands over
     * money it is owed and asks for it back; on `deduct` it never lets go of
     * it. That is why only the platform may grant `invoice` (rule #92).
     */
    it("puts the platform's own money in the partner's hands on invoice", () => {
      const deducted = collectionFor({ ...stay, mode: "deduct", paymentMode: "prepay" })
      const billed = collectionFor({ ...stay, mode: "invoice", paymentMode: "prepay" })

      expect(billed.payout - deducted.payout).toBe(stay.commission)
      expect(billed.billed).toBe(stay.commission)
    })
  })

  describe("guarantee — the property is holding the money", () => {
    /*
     * The line goes NEGATIVE, and that is the point (rule #52).
     *
     * The platform collected nothing on this stay, so it cannot pay itself
     * from it — but the partner's PREPAID bookings in the same cycle can. Only
     * a cycle that cannot cover itself becomes an invoice.
     *
     * An earlier version of this sent every guarantee commission straight to
     * the monthly bill. It read more cleanly and left the platform exposed for
     * money it had been holding a moment earlier.
     */
    it("deducts anyway, letting the cycle absorb it", () => {
      expect(collectionFor({ ...stay, gross: 0, mode: "deduct", paymentMode: "guarantee" })).toEqual({
        collect: "deducted",
        payout: -20_000,
        billed: 0,
      })
    })

    it("bills on an invoice org, like everything else there", () => {
      expect(collectionFor({ ...stay, gross: 0, mode: "invoice", paymentMode: "guarantee" })).toEqual({
        collect: "billed",
        payout: 0,
        billed: 20_000,
      })
    })
  })

  /*
   * A negative payout on `deduct` is not an error — it is the partner owing
   * the platform, which the rest of the cycle settles.
   */
  it("lets a line go negative on deduct, because the cycle nets it", () => {
    const odd = collectionFor({
      gross: 10_000,
      commission: 15_000,
      mode: "deduct",
      paymentMode: "prepay",
    })
    expect(odd.payout).toBe(-5_000)
  })

  it("always accounts for the whole commission, once", () => {
    for (const mode of ["deduct", "invoice"] as const) {
      for (const paymentMode of ["prepay", "guarantee"] as const) {
        const gross = paymentMode === "guarantee" ? 0 : stay.gross
        const result = collectionFor({ ...stay, gross, mode, paymentMode })
        const accountedFor =
          result.collect === "deducted" ? gross - result.payout : result.billed
        expect(accountedFor).toBe(stay.commission)
      }
    }
  })
})

describe("summariseInvoice", () => {
  const lines = [
    { bookingId: "a", ref: "STY-1", total: 100_000, commission: 20_000 },
    { bookingId: "b", ref: "STY-2", total: 50_000, commission: 10_000 },
  ]

  it("adds the commission, and shows the gross it came from", () => {
    expect(summariseInvoice(lines)).toEqual({
      bookings: 2,
      gross: 150_000,
      amount: 30_000,
    })
  })

  it("has nothing to say about an empty month", () => {
    expect(summariseInvoice([])).toEqual({ bookings: 0, gross: 0, amount: 0 })
  })
})

describe("isOverdue", () => {
  it("is not overdue on the due date itself", () => {
    expect(isOverdue({ dueDate: "2026-09-15", today: "2026-09-15", state: "issued" })).toBe(false)
  })

  it("is overdue the day after", () => {
    expect(isOverdue({ dueDate: "2026-09-15", today: "2026-09-16", state: "issued" })).toBe(true)
  })

  it("is never overdue once it has been paid or voided", () => {
    expect(isOverdue({ dueDate: "2026-09-15", today: "2026-12-01", state: "paid" })).toBe(false)
    expect(isOverdue({ dueDate: "2026-09-15", today: "2026-12-01", state: "void" })).toBe(false)
  })

  it("gives a fortnight, which catches one payment run", () => {
    expect(INVOICE_DUE_DAYS).toBe(14)
  })
})

describe("what an overdue invoice costs (rule #95)", () => {
  it("stops the money and takes the privilege back", () => {
    expect(OVERDUE_CONSEQUENCE.revertToDeduct).toBe(true)
    expect(OVERDUE_CONSEQUENCE.holdPayouts).toBe(true)
  })

  /*
   * The guest booked and did nothing wrong. Pulling the listing punishes them
   * for the partner's unpaid bill.
   */
  it("leaves the listing on the market", () => {
    expect(OVERDUE_CONSEQUENCE.suspendListings).toBe(false)
  })
})
