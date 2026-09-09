import { z } from "zod"

import type { RegistrationDraft, RegistrationUnit } from "../types/registration"
import { centsSchema } from "./common"
import { PROPERTY_TYPE_VALUES } from "./catalog"

/* ============================================================================
 * Module 12 — the registration wizard (rule #103).
 *
 * The draft lives as one JSON document, and this is what stops it becoming a
 * fifth type system: every write is validated against these shapes, and the
 * vocabularies are IMPORTED from the contracts the rest of the API uses rather
 * than re-listed here.
 *
 * `.deepPartial()`-by-hand: every field is optional, because a wizard is
 * answered a screen at a time and a half-filled draft is the normal state.
 * What is REQUIRED is checked at submit, by `submissionGaps` — not on the way
 * in, where it would refuse to save a partner's progress.
 * ========================================================================== */

const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM")

/** A room type as the wizard's unit sub-flow builds it (steps 14–19). */
export const registrationUnitSchema = z
  .object({
    unitType: z.string().trim().max(80),
    unitCount: z.coerce.number().int().min(1).max(500),
    beds: z
      .object({
        twin: z.coerce.number().int().min(0).max(20),
        full: z.coerce.number().int().min(0).max(20),
        queen: z.coerce.number().int().min(0).max(20),
        king: z.coerce.number().int().min(0).max(20),
      })
      .partial()
      .strict(),
    guests: z.coerce.number().int().min(1).max(30),
    size: z.string().trim().max(40),
    smoking: z.boolean(),
    amenities: z.array(z.string().trim().max(64)).max(100),
    bathroomPrivate: z.boolean().nullable(),
    bathroomItems: z.array(z.string().trim().max(64)).max(100),
    name: z.string().trim().max(120),
    /** CENTS, like every other price in the system. */
    price: centsSchema,
    ratePlan: z
      .object({
        enabled: z.boolean(),
        /** Percent off, for the non-refundable plan the wizard offers. */
        discount: z.coerce.number().int().min(0).max(100),
      })
      .partial()
      .strict(),
  })
  .partial()
  .strict()

/** Checked against the hand-written type, so the two cannot drift. */
export type RegistrationUnitInput = z.infer<typeof registrationUnitSchema>
const _unitMatchesType: RegistrationUnitInput extends RegistrationUnit ? true : never = true
void _unitMatchesType

export const registrationDraftSchema = z
  .object({
    /* -------------------------------------------- property basics (5–7) */
    propertyName: z.string().trim().max(160),
    propertyType: z.enum(PROPERTY_TYPE_VALUES).nullable(),
    street: z.string().trim().max(200),
    city: z.string().trim().max(120),
    state: z.string().trim().max(120),
    zip: z.string().trim().max(20),
    country: z.string().trim().max(80),

    /* --------------------------------------------------- details (8–12) */
    /** Amenity SLUGS from the platform's vocabulary (rule #74), not labels. */
    amenities: z.array(z.string().trim().max(64)).max(200),
    description: z.string().trim().max(5000),
    /** Seeds each room's price in the unit sub-flow (step 18). */
    baseRate: centsSchema,
    /*
     * No `weekendPricing` / `weekendMarkup`.
     *
     * They were collected by step 10 and read by nothing, because there is no
     * day-of-week pricing in this system: rate plans do not carry one, the
     * calendar is per DATE, and the quote never asks what day it is. Storing
     * them made the wizard's switch look like a rule the platform would apply.
     * Per-date pricing is the extranet calendar's job, after approval.
     */
    checkInFrom: timeOfDay,
    checkOutBy: timeOfDay,
    cancellationPolicy: z
      .enum(["flexible", "moderate", "strict", "non_refundable"])
      .nullable(),
    houseRules: z.array(z.string().trim().max(300)).max(50),

    /* ------------------------------------------------------ payout (12) */
    payoutCurrency: z.string().trim().length(3),
    accountHolder: z.string().trim().max(160),
    bankName: z.string().trim().max(160),
    iban: z.string().trim().max(40),
    swift: z.string().trim().max(20),

    /* ------------------------------------------------------ units (14–19) */
    units: z.array(registrationUnitSchema).max(50),
    draftUnit: registrationUnitSchema,

    /* ------------------------------------------------------ final (21–31) */
    /**
     * Who takes the guest's money (rule #42).
     *
     * `platform` is `prepay`, `property` is `guarantee`. The wizard's two words
     * are translated at submit rather than stored as a third vocabulary.
     */
    paymentMethod: z.enum(["platform", "property"]).nullable(),
    invoiceNameType: z.enum(["personal", "property", "company"]),
    invoiceAddressSame: z.boolean(),
    invoiceName: z.string().trim().max(160),
    invoiceAddress: z.string().trim().max(300),
    ownerType: z.enum(["individual", "business"]),
    hostType: z.enum(["private", "professional"]).nullable(),
    contractType: z.enum(["individual", "business"]).nullable(),
    agreedToTerms: z.boolean(),
  })
  .partial()
  .strict()

export type RegistrationDraftInput = z.infer<typeof registrationDraftSchema>
const _draftMatchesType: RegistrationDraftInput extends RegistrationDraft ? true : never = true
void _draftMatchesType

/**
 * One save from one screen.
 *
 * `step` is the screen they are ON, not the one they came from — the resume
 * point. Sent with every patch so a partner who closes the tab mid-form comes
 * back to the same screen rather than to the start of the section.
 */
export const registrationPatchSchema = z
  .object({
    step: z.coerce.number().int().min(1).max(31).optional(),
    data: registrationDraftSchema,
  })
  .strict()

export type RegistrationPatchInput = z.infer<typeof registrationPatchSchema>

/** Uploading a verification document (step 29). Same shape as a listing photo. */
export const registrationDocumentSchema = z
  .object({
    kind: z.enum(["identity", "ownership", "business", "tax", "other", "photo"]),
    fileName: z.string().trim().min(1).max(255),
    contentType: z.string().trim().min(1).max(100),
    /** Bytes, so the size limit can be refused before a URL is ever handed out. */
    size: z.coerce.number().int().min(1),
  })
  .strict()

export type RegistrationDocumentInput = z.infer<typeof registrationDocumentSchema>

export const registrationDecisionSchema = z
  .object({
    decision: z.enum(["approve", "reject"]),
    note: z.string().trim().max(2000).default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision === "reject" && value.note.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Say why — a rejection with no reason is a support ticket",
      })
    }
  })

export type RegistrationDecisionInput = z.infer<typeof registrationDecisionSchema>

/* --------------------------------------------------------------- outputs -- */

export type RegistrationDocumentView = {
  id: string
  /** `photo` is a listing photograph; the rest are verification documents. */
  kind: "identity" | "ownership" | "business" | "tax" | "other" | "photo"
  status: "pending" | "approved" | "rejected"
  fileName: string
  url: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
}

export type RegistrationView = {
  id: string
  status: "in_progress" | "submitted" | "approved" | "rejected"
  currentStep: number
  data: RegistrationDraft
  /** What is still missing before it can be submitted — every gap, not the first. */
  gaps: string[]
  documents: RegistrationDocumentView[]
  submittedAt: string | null
  decidedAt: string | null
  decisionNote: string | null
  orgId: string | null
  propertyId: string | null
  /**
   * What the platform will charge if this is approved, in basis points.
   *
   * The applicant's own commercial term, so it belongs on their own draft.
   * The alternative is a number printed in the wizard's copy, which drifts
   * from `defaultCommissionRateBps` the first time the platform changes it —
   * and the person finding out is somebody reading their first invoice.
   */
  commissionRateBps: number
}

export type AdminRegistrationRow = {
  id: string
  status: RegistrationView["status"]
  currentStep: number
  propertyName: string
  city: string
  country: string
  applicantName: string
  applicantEmail: string
  documents: number
  submittedAt: string | null
  createdAt: string
}

export const registrationSearchSchema = z
  .object({
    status: z.enum(["in_progress", "submitted", "approved", "rejected"]).optional(),
    q: z.string().trim().max(160).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.string().max(64).optional(),
  })
  .strict()

export type RegistrationSearchInput = z.infer<typeof registrationSearchSchema>
