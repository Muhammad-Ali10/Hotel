import { describe, expect, it } from "vitest"

import type { BookingPricing } from "../types/booking"
import type { CancellationPolicy } from "../types/property"
import {
  cancellationDeadline,
  chargeLabel,
  freeUntilLabel,
  isValidPolicy,
  noShowText,
  policyText,
  refundFor,
} from "./cancellation"

/** The Ritz's migrated policy: 48h free, then 50% of the room. */
const fiftyPercent: CancellationPolicy = {
  freeUntil: "48h",
  charge: "percent",
  chargeValue: 50,
}

const stay = {
  checkIn: "2026-08-12",
  checkInTime: "15:00",
  timezone: "America/New_York",
}

/**
 * 3 nights: $700 + $750 + $725 = $2,175, plus $257 of extras.
 * The first night is deliberately NOT the average.
 */
const pricing: BookingPricing = {
  nights: 3,
  nightlyRates: [70_000, 75_000, 72_500],
  ratePerNight: 72_500,
  roomSubtotal: 217_500,
  addOnsTotal: 25_700,
  total: 243_200,
}

const at = (iso: string) => new Date(iso)

describe("cancellationDeadline", () => {
  it("resolves 48h as two calendar days at the property's check-in time", () => {
    // The exact promise on the public policy page — measured in wall clock,
    // not in raw hours.
    const deadline = cancellationDeadline({ policy: fiftyPercent, ...stay })
    expect(deadline?.toISOString()).toBe("2026-08-10T19:00:00.000Z") // 15:00 EDT
  })

  it("keeps the wall clock across a daylight-saving boundary", () => {
    // US DST ends 2026-11-01. A 15:00 check-in on the 2nd has its 48h deadline
    // at 15:00 on Oct 31 — EDT, an hour off from a naive 48×3600s subtraction.
    const deadline = cancellationDeadline({
      policy: fiftyPercent,
      checkIn: "2026-11-02",
      checkInTime: "15:00",
      timezone: "America/New_York",
    })
    expect(deadline?.toISOString()).toBe("2026-10-31T19:00:00.000Z")
  })

  it("resolves the Tokyo case the policy page names", () => {
    const deadline = cancellationDeadline({
      policy: fiftyPercent,
      checkIn: "2026-08-12",
      checkInTime: "15:00",
      timezone: "Asia/Tokyo",
    })
    // 15:00 Tokyo two days before = 06:00 UTC
    expect(deadline?.toISOString()).toBe("2026-08-10T06:00:00.000Z")
  })

  it("resolves 6pm on the arrival day, in the property's zone", () => {
    const deadline = cancellationDeadline({
      policy: { freeUntil: "6pm_arrival", charge: "first_night", chargeValue: null },
      ...stay,
    })
    expect(deadline?.toISOString()).toBe("2026-08-12T22:00:00.000Z") // 18:00 EDT
  })

  it("resolves the longer windows", () => {
    for (const [freeUntil, expected] of [
      ["24h", "2026-08-11T19:00:00.000Z"],
      ["7d", "2026-08-05T19:00:00.000Z"],
      ["14d", "2026-07-29T19:00:00.000Z"],
    ] as const) {
      const deadline = cancellationDeadline({
        policy: { freeUntil, charge: "full", chargeValue: null },
        ...stay,
      })
      expect(deadline?.toISOString()).toBe(expected)
    }
  })

  it("has no deadline at all for a non-refundable rate", () => {
    expect(
      cancellationDeadline({
        policy: { freeUntil: "non_refundable", charge: "full", chargeValue: null },
        ...stay,
      })
    ).toBeNull()
  })
})

describe("refundFor", () => {
  it("refunds everything inside the free window", () => {
    const result = refundFor({
      policy: fiftyPercent,
      pricing,
      ...stay,
      cancelledAt: at("2026-08-01T00:00:00Z"),
    })
    expect(result).toMatchObject({
      refund: 243_200,
      charged: 0,
      refundStatus: "full",
      withinFreeWindow: true,
    })
  })

  it("treats the deadline instant itself as still free", () => {
    const result = refundFor({
      policy: fiftyPercent,
      pricing,
      ...stay,
      cancelledAt: at("2026-08-10T19:00:00.000Z"),
    })
    expect(result.withinFreeWindow).toBe(true)
    expect(result.refund).toBe(243_200)
  })

  it("charges one second after the deadline", () => {
    const result = refundFor({
      policy: fiftyPercent,
      pricing,
      ...stay,
      cancelledAt: at("2026-08-10T19:00:01.000Z"),
    })
    expect(result.withinFreeWindow).toBe(false)
    // 50% of the room ($1,087.50) is kept; all $257 of extras come back.
    expect(result.charged).toBe(108_750)
    expect(result.refund).toBe(134_450)
    expect(result.refundStatus).toBe("partial")
  })

  it("charges the REAL first night, not the stay average (rule #1)", () => {
    // Nightly rates are 700 / 750 / 725 — the average is 725, the first is 700.
    const result = refundFor({
      policy: { freeUntil: "48h", charge: "first_night", chargeValue: null },
      pricing,
      ...stay,
      cancelledAt: at("2026-08-11T00:00:00Z"),
    })
    expect(result.charged).toBe(70_000)
    expect(result.refund).toBe(173_200)
  })

  it("applies the penalty to the room only — extras always come back (rule #18)", () => {
    const result = refundFor({
      policy: { freeUntil: "48h", charge: "full", chargeValue: null },
      pricing,
      ...stay,
      cancelledAt: at("2026-08-11T00:00:00Z"),
    })
    // Whole room kept, every extra refunded.
    expect(result.charged).toBe(217_500)
    expect(result.refund).toBe(25_700)
    expect(result.refundStatus).toBe("partial")
  })

  it("charges the DISCOUNTED room, not the list price", () => {
    const discounted: BookingPricing = {
      ...pricing,
      discount: { id: "promo", label: "20% OFF", amount: -43_500 },
      total: 199_700, // 217500 − 43500 + 25700
    }
    const result = refundFor({
      policy: { freeUntil: "48h", charge: "full", chargeValue: null },
      pricing: discounted,
      ...stay,
      cancelledAt: at("2026-08-11T00:00:00Z"),
    })
    // Guest paid $1,740 for the room, so that is the most that can be kept.
    expect(result.charged).toBe(174_000)
    expect(result.refund).toBe(25_700)
  })

  it("keeps the room on a non-refundable rate but still returns the extras", () => {
    // Deliberate resolution of the rule #1 / rule #18 collision: non-refundable
    // describes the ROOM. The airport transfer was never delivered.
    const result = refundFor({
      policy: { freeUntil: "non_refundable", charge: "full", chargeValue: null },
      pricing,
      ...stay,
      cancelledAt: at("2026-01-01T00:00:00Z"), // months ahead, still no free window
    })
    expect(result.withinFreeWindow).toBe(false)
    expect(result.charged).toBe(217_500)
    expect(result.refund).toBe(25_700)
    expect(result.deadline).toBeNull()
  })

  it("reports `none` when nothing at all comes back", () => {
    const roomOnly: BookingPricing = { ...pricing, addOnsTotal: 0, total: 217_500 }
    const result = refundFor({
      policy: { freeUntil: "non_refundable", charge: "full", chargeValue: null },
      pricing: roomOnly,
      ...stay,
      cancelledAt: at("2026-08-11T00:00:00Z"),
    })
    expect(result).toMatchObject({ refund: 0, refundStatus: "none" })
  })

  it("never charges more than a one-night stay is worth", () => {
    const oneNight: BookingPricing = {
      nights: 1,
      nightlyRates: [70_000],
      ratePerNight: 70_000,
      roomSubtotal: 70_000,
      addOnsTotal: 0,
      total: 70_000,
    }
    const result = refundFor({
      policy: { freeUntil: "48h", charge: "first_night", chargeValue: null },
      pricing: oneNight,
      ...stay,
      cancelledAt: at("2026-08-11T00:00:00Z"),
    })
    expect(result.charged).toBe(70_000)
    expect(result.refund).toBe(0)
  })

  it("surfaces the deadline it used, so a screen can show a countdown", () => {
    const result = refundFor({
      policy: fiftyPercent,
      pricing,
      ...stay,
      cancelledAt: at("2026-08-01T00:00:00Z"),
    })
    expect(result.deadline).toBe("2026-08-10T19:00:00.000Z")
  })
})

describe("who cancelled (rule #37)", () => {
  it("refunds in full when the PROPERTY cancels, whatever the policy says", async () => {
    // The guest kept their side of the bargain. A non-refundable rate is the
    // guest accepting the risk of THEIR plans changing, not the property's.
    const result = refundFor({
      policy: { freeUntil: "non_refundable", charge: "full", chargeValue: null },
      pricing,
      ...stay,
      cancelledAt: at("2026-08-11T00:00:00Z"),
      by: "property",
    })
    expect(result).toMatchObject({ refund: 243_200, charged: 0, refundStatus: "full" })
  })

  it("refunds in full when an ADMIN unwinds it", async () => {
    const result = refundFor({
      policy: fiftyPercent,
      pricing,
      ...stay,
      cancelledAt: at("2026-08-11T00:00:00Z"),
      by: "admin",
    })
    expect(result.refund).toBe(243_200)
  })

  it("still charges the guest when the guest cancels", async () => {
    const result = refundFor({
      policy: fiftyPercent,
      pricing,
      ...stay,
      cancelledAt: at("2026-08-11T00:00:00Z"),
      by: "guest",
    })
    expect(result.charged).toBe(108_750)
  })

  it("treats an unstated party as the guest", async () => {
    // The default must be the strict reading; a forgotten argument must not
    // quietly hand out a full refund.
    const stated = refundFor({ policy: fiftyPercent, pricing, ...stay, cancelledAt: at("2026-08-11T00:00:00Z"), by: "guest" })
    const omitted = refundFor({ policy: fiftyPercent, pricing, ...stay, cancelledAt: at("2026-08-11T00:00:00Z") })
    expect(omitted).toEqual(stated)
  })
})

describe("policyText", () => {
  it("is generated from the same fields the refund uses (rule #1)", () => {
    expect(policyText(fiftyPercent)).toBe(
      "Free cancellation until 48 hours before check-in. After that, 50% of the room rate is charged. Extras are always refunded in full."
    )
  })

  it("describes a first-night charge", () => {
    expect(
      policyText({ freeUntil: "6pm_arrival", charge: "first_night", chargeValue: null })
    ).toContain("the first night is charged")
  })

  it("describes a non-refundable rate honestly, extras included", () => {
    const text = policyText({ freeUntil: "non_refundable", charge: "full", chargeValue: null })
    expect(text).toContain("non-refundable")
    expect(text).toContain("Extras you booked are still refunded")
  })
})

describe("labels", () => {
  it("names every window", () => {
    expect(freeUntilLabel("6pm_arrival")).toBe("6pm on the day of arrival")
    expect(freeUntilLabel("24h")).toBe("24 hours before check-in")
    expect(freeUntilLabel("14d")).toBe("14 days before check-in")
    expect(freeUntilLabel("non_refundable")).toContain("non-refundable")
  })

  it("names every charge", () => {
    expect(chargeLabel({ freeUntil: "48h", charge: "first_night", chargeValue: null })).toContain(
      "first night"
    )
    expect(chargeLabel({ freeUntil: "48h", charge: "percent", chargeValue: 50 })).toContain("50%")
    expect(chargeLabel({ freeUntil: "48h", charge: "full", chargeValue: null })).toContain(
      "full stay"
    )
  })
})

describe("isValidPolicy", () => {
  it("requires chargeValue exactly when the charge is a percentage", () => {
    expect(isValidPolicy({ freeUntil: "48h", charge: "percent", chargeValue: 50 })).toBe(true)
    expect(isValidPolicy({ freeUntil: "48h", charge: "percent", chargeValue: null })).toBe(false)
    expect(isValidPolicy({ freeUntil: "48h", charge: "full", chargeValue: 50 })).toBe(false)
    expect(isValidPolicy({ freeUntil: "48h", charge: "full", chargeValue: null })).toBe(true)
  })

  it("rejects a percentage outside 1–100", () => {
    expect(isValidPolicy({ freeUntil: "48h", charge: "percent", chargeValue: 0 })).toBe(false)
    expect(isValidPolicy({ freeUntil: "48h", charge: "percent", chargeValue: 101 })).toBe(false)
    expect(isValidPolicy({ freeUntil: "48h", charge: "percent", chargeValue: 12.5 })).toBe(false)
  })
})

/* ------------------------------------------------------- no-show (rule #47) */

describe("no-show terms", () => {
  const pricing = {
    roomSubtotal: 217_500,
    addOnsTotal: 0,
    nightlyRates: [72_500, 72_500, 72_500],
    total: 217_500,
  }

  const at = (policy: CancellationPolicy, noShow: boolean) =>
    refundFor({
      policy,
      pricing,
      checkIn: "2026-09-10",
      checkInTime: "15:00",
      timezone: "America/New_York",
      // Inside the 48h deadline either way, so only the terms differ.
      cancelledAt: new Date("2026-09-09T12:00:00.000Z"),
      noShow,
    })

  const flexible: CancellationPolicy = { freeUntil: "48h", charge: "percent", chargeValue: 50 }

  it("falls back to the cancellation terms when the plan says nothing", () => {
    // The behaviour before these fields existed. No property has to opt out.
    expect(at(flexible, true).charged).toBe(at(flexible, false).charged)
    expect(at(flexible, true).charged).toBe(108_750)
  })

  it("lets a plan keep free cancellation AND charge a no-show in full", () => {
    // The policy that was impossible to write down before: strict about not
    // turning up, generous about saying so in time.
    const strict: CancellationPolicy = { ...flexible, noShowCharge: "full" }

    expect(at(strict, false).charged).toBe(108_750) // cancelled late → 50%
    expect(at(strict, true).charged).toBe(217_500) // never arrived → all of it
  })

  it("keeps the free window free for a guest who cancels in time", () => {
    const strict: CancellationPolicy = { ...flexible, noShowCharge: "full" }
    const early = refundFor({
      policy: strict,
      pricing,
      checkIn: "2026-09-10",
      checkInTime: "15:00",
      timezone: "America/New_York",
      cancelledAt: new Date("2026-09-01T12:00:00.000Z"),
    })

    // Being strict about no-shows must not quietly shorten the free window.
    expect(early.charged).toBe(0)
    expect(early.refund).toBe(217_500)
  })

  it("gives a no-show no free window at all", () => {
    const strict: CancellationPolicy = { ...flexible, noShowCharge: "first_night" }
    const early = refundFor({
      policy: strict,
      pricing,
      checkIn: "2026-09-10",
      checkInTime: "15:00",
      timezone: "America/New_York",
      // Before the deadline — but they never cancelled, so it is irrelevant.
      cancelledAt: new Date("2026-09-01T12:00:00.000Z"),
      noShow: true,
    })

    expect(early.withinFreeWindow).toBe(false)
    expect(early.charged).toBe(72_500)
  })

  it("uses the no-show percentage, not the cancellation one", () => {
    // The bug this guards: reading `chargeValue` while switching on
    // `noShowCharge`, so a 100% no-show quietly charges 50%.
    const mixed: CancellationPolicy = {
      ...flexible,
      noShowCharge: "percent",
      noShowChargeValue: 100,
    }
    expect(at(mixed, true).charged).toBe(217_500)
    expect(at(mixed, false).charged).toBe(108_750)
  })

  it("still refunds the extras a no-show never received (rule #18)", () => {
    const strict: CancellationPolicy = { ...flexible, noShowCharge: "full" }
    const withExtras = refundFor({
      policy: strict,
      pricing: { ...pricing, addOnsTotal: 6_500, total: 224_000 },
      checkIn: "2026-09-10",
      checkInTime: "15:00",
      timezone: "America/New_York",
      cancelledAt: new Date("2026-09-09T12:00:00.000Z"),
      noShow: true,
    })

    // The room is the property's; the airport transfer nobody drove is not.
    expect(withExtras.charged).toBe(217_500)
    expect(withExtras.refund).toBe(6_500)
  })

  it("charges a property-caused no-show nothing (rule #37)", () => {
    const strict: CancellationPolicy = { ...flexible, noShowCharge: "full" }
    const blameless = refundFor({
      policy: strict,
      pricing,
      checkIn: "2026-09-10",
      checkInTime: "15:00",
      timezone: "America/New_York",
      cancelledAt: new Date("2026-09-09T12:00:00.000Z"),
      noShow: true,
      by: "property",
    })
    expect(blameless.charged).toBe(0)
  })

  it("writes the stricter term into the sentence the guest reads", () => {
    // The entire justification for allowing it: the guest is told first.
    const strict: CancellationPolicy = { ...flexible, noShowCharge: "full" }
    const text = policyText(strict)

    expect(text).toContain("Free cancellation until 48 hours before check-in")
    expect(text).toContain("do not arrive")
    expect(text).toContain("the full stay is charged")
  })

  it("says nothing extra when the terms are the same", () => {
    // Nothing to add — the cancellation clause already told them.
    expect(noShowText(flexible)).toBeNull()
    expect(policyText(flexible)).not.toContain("do not arrive")
  })

  it("says nothing extra on a non-refundable rate", () => {
    // "You lose the room either way" needs no second sentence.
    expect(
      noShowText({ freeUntil: "non_refundable", charge: "full", chargeValue: null, noShowCharge: "full" })
    ).toBeNull()
  })
})
