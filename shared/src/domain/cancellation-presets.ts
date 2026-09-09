import type { CancelCharge, CancelFreeUntil, CancellationPolicy } from "../types/property"
import type { CancellationPreset } from "../types/registration"

/* ============================================================================
 * The four names a registration wizard offers, and what they actually mean
 * (rule #102).
 *
 * The wizard asks a partner to pick "Flexible", "Moderate", "Strict" or
 * "Non-refundable". A rate plan does not store any of those: it stores a
 * structured policy (rule #1), so the guest-facing sentence can be generated
 * and cannot drift from what is enforced.
 *
 * Without this mapping the wizard would have to write one of those four words
 * into a column that has never accepted them — the same shape of bug as the
 * eight property types the database had never heard of.
 *
 * The mapping is one-way ON PURPOSE. A preset expands to a policy; a policy
 * does not collapse back to a preset, because most policies a partner can
 * build in the extranet are not any of these four. Offering a reverse lookup
 * would mean labelling a hand-tuned policy "Moderate" when it is not.
 * ========================================================================== */

export const CANCELLATION_PRESETS = [
  "flexible",
  "moderate",
  "strict",
  "non_refundable",
] as const satisfies readonly CancellationPreset[]

export type { CancellationPreset }

type PresetShape = {
  freeUntil: CancelFreeUntil
  charge: CancelCharge
  chargeValue: number | null
  /** What the wizard shows beside the choice. Display only. */
  label: string
  blurb: string
}

const PRESETS: Record<CancellationPreset, PresetShape> = {
  flexible: {
    freeUntil: "24h",
    charge: "first_night",
    chargeValue: null,
    label: "Flexible",
    blurb: "Free cancellation until 24 hours before arrival, then the first night.",
  },
  moderate: {
    freeUntil: "48h",
    charge: "first_night",
    chargeValue: null,
    label: "Moderate",
    blurb: "Free cancellation until 48 hours before arrival, then the first night.",
  },
  strict: {
    freeUntil: "7d",
    charge: "full",
    chargeValue: null,
    label: "Strict",
    blurb: "Free cancellation until 7 days before arrival, then the full stay.",
  },
  non_refundable: {
    freeUntil: "non_refundable",
    charge: "full",
    chargeValue: null,
    label: "Non-refundable",
    blurb: "The stay is charged in full and cannot be cancelled.",
  },
}

/** The four choices, for a screen to render. */
export function cancellationPresets(): (PresetShape & { key: CancellationPreset })[] {
  return CANCELLATION_PRESETS.map((key) => ({ key, ...PRESETS[key] }))
}

/**
 * A preset, as the policy a rate plan actually stores.
 *
 * `noShowCharge` is deliberately left unset: a rate plan that says nothing
 * about no-shows falls back to "whatever a cancellation at arrival would have
 * cost" (rule #47), which is the normal case. A wizard picking one for the
 * partner would be choosing a term nobody was shown.
 */
export function policyForPreset(preset: CancellationPreset): CancellationPolicy {
  const shape = PRESETS[preset]
  return {
    freeUntil: shape.freeUntil,
    charge: shape.charge,
    chargeValue: shape.chargeValue,
  }
}
