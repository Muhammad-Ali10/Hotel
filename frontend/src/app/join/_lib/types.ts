import type { RegistrationDraft, RegistrationUnit } from "@stayora/shared"

/* ============================================================================
 * The wizard's view of the registration draft.
 *
 * There is no separate `RegistrationData` any more. The draft the API stores
 * IS the shape, imported from `@stayora/shared` — a local copy is how this
 * codebase ended up with three names for a property, and a fourth would have
 * been the wizard's.
 *
 * What is local is only the FILLED view: `RegistrationDraft` has every field
 * optional, because a half-answered wizard is the normal state, but a screen
 * rendering `data.baseRate` into a number input cannot deal with `undefined`.
 * `fill()` merges the server's draft over the defaults below, so the API keeps
 * its honest partial and the screens keep their concrete values.
 *
 * Gone with the old copy:
 *   · `roomTypes` — a second, thinner room concept alongside `units`, written
 *     by step 7 and read by nothing. The unit sub-flow (14–19) is the real one.
 *   · `photos: number` — a counter, not photographs.
 *   · `cancelFreeUntil` / `cancelCharge` — a second cancellation vocabulary for
 *     the field `cancellationPolicy` already holds (rule #102).
 *   · `email` / `firstName` / `lastName` / `phone` / `verified` — the account,
 *     which belongs to `/auth`, not to a property application.
 * ========================================================================== */

/** A unit with every field present, for the six screens that edit one. */
export type WizardUnit = {
  unitType: string
  unitCount: number
  beds: { twin: number; full: number; queen: number; king: number }
  guests: number
  size: string
  smoking: boolean
  amenities: string[]
  bathroomPrivate: boolean | null
  bathroomItems: string[]
  name: string
  /** CENTS, like every other price in the system. */
  price: number
  ratePlan: { enabled: boolean; discount: number }
}

/** Checked against the wire shape, so the filled view cannot drift from it. */
const _unitFits: WizardUnit extends RegistrationUnit ? true : never = true
void _unitFits

export type WizardData = {
  propertyName: string
  propertyType: NonNullable<RegistrationDraft["propertyType"]> | null
  street: string
  city: string
  state: string
  zip: string
  country: string

  /** Amenity SLUGS from the platform's vocabulary (rule #74), not labels. */
  amenities: string[]
  description: string
  /** CENTS. Seeds each room's price in the unit sub-flow. */
  baseRate: number
  checkInFrom: string
  checkOutBy: string
  cancellationPolicy: NonNullable<RegistrationDraft["cancellationPolicy"]> | null
  houseRules: string[]

  payoutCurrency: string
  accountHolder: string
  bankName: string
  iban: string
  swift: string

  units: WizardUnit[]
  draftUnit: WizardUnit

  paymentMethod: "platform" | "property" | null
  invoiceNameType: "personal" | "property" | "company"
  invoiceAddressSame: boolean
  invoiceName: string
  invoiceAddress: string
  ownerType: "individual" | "business"
  hostType: "private" | "professional" | null
  contractType: "individual" | "business" | null
  agreedToTerms: boolean
}

const _dataFits: WizardData extends RegistrationDraft ? true : never = true
void _dataFits

export function newUnit(): WizardUnit {
  return {
    unitType: "Room",
    unitCount: 1,
    beds: { twin: 0, full: 0, queen: 1, king: 0 },
    guests: 2,
    size: "",
    smoking: false,
    amenities: [],
    bathroomPrivate: null,
    bathroomItems: [],
    name: "",
    price: 0,
    ratePlan: { enabled: false, discount: 10 },
  }
}

/**
 * What a screen sees before the draft has loaded, and under every partial one.
 *
 * `country` no longer defaults to Pakistan. A default country is a guess about
 * where the property is, and the address screen is one field away — a wrong
 * guess that looks answered is worse than an empty select.
 */
export const emptyDraft: WizardData = {
  propertyName: "",
  propertyType: null,
  street: "",
  city: "",
  state: "",
  zip: "",
  country: "",

  amenities: [],
  description: "",
  baseRate: 0,
  checkInFrom: "14:00",
  checkOutBy: "12:00",
  cancellationPolicy: null,
  houseRules: [],

  payoutCurrency: "USD",
  accountHolder: "",
  bankName: "",
  iban: "",
  swift: "",

  units: [],
  draftUnit: newUnit(),

  paymentMethod: null,
  invoiceNameType: "property",
  invoiceAddressSame: true,
  invoiceName: "",
  invoiceAddress: "",
  ownerType: "individual",
  hostType: null,
  contractType: null,
  agreedToTerms: false,
}

function fillUnit(unit: RegistrationUnit | undefined): WizardUnit {
  const base = newUnit()
  if (!unit) return base
  return {
    ...base,
    ...unit,
    beds: { ...base.beds, ...(unit.beds ?? {}) },
    ratePlan: { ...base.ratePlan, ...(unit.ratePlan ?? {}) },
  }
}

/**
 * The server's partial draft as something a form can render.
 *
 * Spread rather than field-by-field so a field added to the contract reaches
 * the screens without a second edit here — the `satisfies` above is what keeps
 * that safe.
 */
export function fill(draft: RegistrationDraft | undefined): WizardData {
  if (!draft) return emptyDraft
  return {
    ...emptyDraft,
    ...draft,
    units: (draft.units ?? []).map(fillUnit),
    draftUnit: fillUnit(draft.draftUnit),
  }
}
