import { describe, expect, it } from "vitest"

import type { RegistrationDraft } from "../types/registration"
import {
  bedCapacity,
  bedSummary,
  canSubmit,
  paymentModeFor,
  REGISTRATION_MINIMUM,
  submissionGaps,
} from "./registration"
import { cancellationPresets, policyForPreset } from "./cancellation-presets"

const complete: RegistrationDraft = {
  propertyName: "The Plaza",
  propertyType: "hotel",
  street: "768 5th Ave",
  city: "New York",
  country: "USA",
  description: "x".repeat(REGISTRATION_MINIMUM.descriptionChars),
  units: [{ name: "Deluxe King", price: 52_000, guests: 2 }],
  cancellationPolicy: "moderate",
  paymentMethod: "platform",
  accountHolder: "Aurora Hospitality",
  iban: "GB33BUKB20201555555555",
  agreedToTerms: true,
}

describe("registration", () => {
  it("accepts a complete draft", () => {
    expect(submissionGaps(complete)).toEqual([])
    expect(canSubmit(complete)).toBe(true)
  })

  it("reports EVERY gap, not the first", () => {
    const gaps = submissionGaps({})

    /*
     * A partner told "add a description", who adds one and is then told "add a
     * room", learns the form is lying about how much is left.
     */
    expect(gaps.length).toBeGreaterThan(5)
    expect(gaps).toContain("Name the property")
    expect(gaps).toContain("Choose a cancellation policy")
    expect(gaps).toContain("Accept the partner agreement")
  })

  it("names the room that is unfinished", () => {
    const gaps = submissionGaps({
      ...complete,
      units: [
        { name: "Deluxe King", price: 52_000, guests: 2 },
        { name: "Garden Suite", guests: 2 },
      ],
    })

    // "One of your rooms has no price" is a hunt through six screens.
    expect(gaps).toEqual(["Set a nightly price for Garden Suite"])
  })

  it("falls back to a room's type, then to its position, for the label", () => {
    expect(submissionGaps({ ...complete, units: [{ unitType: "Studio", guests: 2 }] })).toEqual([
      "Name Studio",
      "Set a nightly price for Studio",
    ])
    expect(submissionGaps({ ...complete, units: [{ guests: 2 }] })).toEqual([
      "Name Room 1",
      "Set a nightly price for Room 1",
    ])
  })

  it("requires a payout account before the listing can go live", () => {
    /*
     * A property live without one earns money the platform cannot send
     * anywhere, and the partner finds out at the end of the first cycle.
     */
    expect(submissionGaps({ ...complete, iban: "" })).toEqual([
      "Add the bank account payouts should go to",
    ])
  })

  it("counts a short description as missing", () => {
    const gaps = submissionGaps({ ...complete, description: "Nice hotel." })
    expect(gaps).toHaveLength(1)
    expect(gaps[0]).toContain(String(REGISTRATION_MINIMUM.descriptionChars))
  })

  it("translates the wizard's words for who takes the money", () => {
    expect(paymentModeFor("platform")).toBe("prepay")
    expect(paymentModeFor("property")).toBe("guarantee")
  })

  it("counts beds without overriding what the partner typed", () => {
    expect(bedCapacity({ beds: { twin: 2, queen: 1 } })).toBe(4)
    expect(bedCapacity({ beds: { king: 1 } })).toBe(2)
    expect(bedCapacity({})).toBe(0)
  })

  it("describes the beds in one line, largest first", () => {
    expect(bedSummary({ beds: { twin: 2, king: 1 } })).toBe("1 king bed, 2 twin beds")
    expect(bedSummary({ beds: { queen: 1 } })).toBe("1 queen bed")
    expect(bedSummary({})).toBe("")
  })
})

describe("cancellation presets", () => {
  it("turns each of the four names into a real policy", () => {
    // The wizard's four words are not a column anywhere. Without this they
    // would be written into one that has never accepted them.
    expect(policyForPreset("flexible")).toEqual({
      freeUntil: "24h",
      charge: "first_night",
      chargeValue: null,
    })
    expect(policyForPreset("non_refundable")).toEqual({
      freeUntil: "non_refundable",
      charge: "full",
      chargeValue: null,
    })
  })

  it("never chooses a no-show term the partner was not shown", () => {
    // Silence means "whatever a cancellation at arrival would have cost"
    // (rule #47) — which is the normal case, not an oversight.
    for (const preset of cancellationPresets()) {
      expect(policyForPreset(preset.key)).not.toHaveProperty("noShowCharge")
    }
  })

  it("offers all four with something to read", () => {
    const presets = cancellationPresets()
    expect(presets).toHaveLength(4)
    for (const preset of presets) {
      expect(preset.label.length).toBeGreaterThan(0)
      expect(preset.blurb.length).toBeGreaterThan(10)
    }
  })
})
