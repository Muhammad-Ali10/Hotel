import type { Cents } from "./common"
import type { PropertyType } from "./property"

/* ============================================================================
 * The registration draft (Module 12, rule #103).
 *
 * Declared here, in `types/`, rather than inferred from the zod schema in
 * `contracts/`. The domain functions that read a draft — `submissionGaps`,
 * `bedCapacity` — would otherwise have to import from `contracts/`, and the
 * layering in this package runs one way only: contracts and domain may both
 * read `types/`, and `domain/` never reads `contracts/`.
 *
 * `contracts/registration.ts` builds the validator and checks it against these
 * types with `satisfies`, so the two cannot drift.
 * ========================================================================== */

/** The four presets a registration wizard offers, before they become a policy. */
export type CancellationPreset = "flexible" | "moderate" | "strict" | "non_refundable"

/** A room type as the wizard's unit sub-flow builds it (steps 14–19). */
export type RegistrationUnit = {
  unitType?: string
  unitCount?: number
  beds?: { twin?: number; full?: number; queen?: number; king?: number }
  guests?: number
  size?: string
  smoking?: boolean
  amenities?: string[]
  bathroomPrivate?: boolean | null
  bathroomItems?: string[]
  name?: string
  /** CENTS, like every other price in the system. */
  price?: Cents
  ratePlan?: { enabled?: boolean; discount?: number }
}

/**
 * Everything the wizard collects.
 *
 * Every field optional, because a wizard is answered a screen at a time and a
 * half-filled draft is the normal state — not an error. What is REQUIRED is
 * decided at submit, by `submissionGaps`.
 */
export type RegistrationDraft = {
  propertyName?: string
  propertyType?: PropertyType | null
  street?: string
  city?: string
  state?: string
  zip?: string
  country?: string

  /** Amenity SLUGS from the platform's vocabulary (rule #74), not labels. */
  amenities?: string[]
  description?: string
  /** Seeds each room's price in the unit sub-flow (step 18). */
  baseRate?: Cents
  checkInFrom?: string
  checkOutBy?: string
  cancellationPolicy?: CancellationPreset | null
  houseRules?: string[]

  payoutCurrency?: string
  accountHolder?: string
  bankName?: string
  iban?: string
  swift?: string

  units?: RegistrationUnit[]
  draftUnit?: RegistrationUnit

  /** `platform` is prepay, `property` is guarantee (rule #42). */
  paymentMethod?: "platform" | "property" | null
  invoiceNameType?: "personal" | "property" | "company"
  invoiceAddressSame?: boolean
  invoiceName?: string
  invoiceAddress?: string
  ownerType?: "individual" | "business"
  hostType?: "private" | "professional" | null
  contractType?: "individual" | "business" | null
  agreedToTerms?: boolean
}
