import type { RegistrationDraft, RegistrationUnit } from "../types/registration"

/* ============================================================================
 * What a registration needs before it can be submitted (rule #103).
 *
 * Checked HERE and not on the way in. A wizard is answered a screen at a time,
 * and a validator that refused an incomplete draft would refuse to save a
 * partner's progress — which is the one thing the server is for.
 * ========================================================================== */

/** How many photos a listing needs to go live (rule #70), restated for the wizard. */
export const REGISTRATION_MINIMUM = {
  descriptionChars: 120,
  units: 1,
} as const

/**
 * Every gap, never just the first.
 *
 * A partner told "add a description", who adds one and is then told "add a
 * room", learns that the form is lying to them about how much is left. The
 * order is the wizard's own, so the list reads as a route back through it.
 */
export function submissionGaps(draft: RegistrationDraft): string[] {
  const gaps: string[] = []

  if (!draft.propertyName?.trim()) gaps.push("Name the property")
  if (!draft.propertyType) gaps.push("Choose what kind of place it is")
  if (!draft.street?.trim() || !draft.city?.trim() || !draft.country?.trim()) {
    gaps.push("Give the full address")
  }

  const description = draft.description?.trim() ?? ""
  if (description.length < REGISTRATION_MINIMUM.descriptionChars) {
    gaps.push(
      `Describe the property in at least ${REGISTRATION_MINIMUM.descriptionChars} characters`
    )
  }

  const units = draft.units ?? []
  if (units.length < REGISTRATION_MINIMUM.units) {
    gaps.push("Add at least one room")
  } else {
    /*
     * Named, so a partner with six rooms is told WHICH one is unfinished.
     * "One of your rooms has no price" is a hunt through six screens.
     */
    units.forEach((unit, i) => {
      const label = unit.name?.trim() || unit.unitType?.trim() || `Room ${i + 1}`
      if (!unit.name?.trim()) gaps.push(`Name ${label}`)
      if (!unit.price) gaps.push(`Set a nightly price for ${label}`)
      if (!unit.guests) gaps.push(`Say how many guests ${label} sleeps`)
    })
  }

  if (!draft.cancellationPolicy) gaps.push("Choose a cancellation policy")
  if (!draft.paymentMethod) gaps.push("Choose how guests pay")

  /*
   * The payout account is required to SUBMIT, not to get paid later.
   *
   * A property that goes live without one earns money the platform then cannot
   * send anywhere, and the partner finds out at the end of the first cycle.
   */
  if (!draft.accountHolder?.trim() || !draft.iban?.trim()) {
    gaps.push("Add the bank account payouts should go to")
  }

  if (!draft.agreedToTerms) gaps.push("Accept the partner agreement")

  return gaps
}

export function canSubmit(draft: RegistrationDraft): boolean {
  return submissionGaps(draft).length === 0
}

/* ---------------------------------------------------------- translations -- */

/**
 * The wizard's two words for who takes the money, in the API's (rule #42).
 *
 * `platform` charges the card now; `property` holds it and settles at the
 * desk. Translated at submit rather than stored, so the wizard's wording never
 * becomes a third vocabulary for something the booking tables already name.
 */
export function paymentModeFor(method: "platform" | "property"): "prepay" | "guarantee" {
  return method === "platform" ? "prepay" : "guarantee"
}

/**
 * Total sleeping capacity of a unit, from its bed counts.
 *
 * A twin sleeps one, everything else sleeps two. Used as a FLOOR under the
 * partner's own answer, never as a replacement for it: a room with a sofa bed
 * legitimately sleeps more than its beds suggest, and overriding what they
 * typed would tell them they were wrong about their own room.
 */
export function bedCapacity(unit: RegistrationUnit): number {
  const beds = unit.beds ?? {}
  return (
    (beds.twin ?? 0) * 1 + ((beds.full ?? 0) + (beds.queen ?? 0) + (beds.king ?? 0)) * 2
  )
}

/** A one-line description of the beds, for the room's own summary. */
export function bedSummary(unit: RegistrationUnit): string {
  const beds = unit.beds ?? {}
  const parts: string[] = []
  const add = (n: number | undefined, noun: string) => {
    if (n && n > 0) parts.push(`${n} ${noun}${n === 1 ? "" : "s"}`)
  }
  add(beds.king, "king bed")
  add(beds.queen, "queen bed")
  add(beds.full, "double bed")
  add(beds.twin, "twin bed")
  return parts.join(", ")
}
