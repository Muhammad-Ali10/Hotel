import { z } from "zod"

import { emailSchema, isoDateSchema, uuidSchema } from "./common"

/* ============================================================================
 * Partner org and team (Module 10).
 *
 * Until now `partner_orgs` and `partner_members` had no write path at all: an
 * organisation and its people could only be conjured by a direct INSERT, which
 * meant nothing built for partners could actually be used by one.
 * ========================================================================== */

export const PARTNER_ROLES = ["admin", "manager", "staff"] as const
export type PartnerMemberRole = (typeof PARTNER_ROLES)[number]

/* ------------------------------------------------------------------- org -- */

/**
 * What a PARTNER may change about their own organisation.
 *
 * The omissions are the contract (API3): `commissionRateBps`, `planTier` and
 * `status` are the platform's side of the agreement, not the property's. A
 * partner who could set their own commission would set it to zero.
 */
export const orgUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    contactEmail: emailSchema,
    contactPhone: z.string().trim().max(32),
    country: z.string().trim().max(80),
  })
  .partial()
  .strict()

export type OrgUpdateInput = z.infer<typeof orgUpdateSchema>

/** What the PLATFORM sets when it onboards a partner (rule #59). */
export const orgCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    contactEmail: emailSchema,
    contactPhone: z.string().trim().max(32).default(""),
    country: z.string().trim().max(80).default(""),
    planTier: z.enum(["starter", "professional", "enterprise"]).default("starter"),
    /**
     * Basis points, so a negotiated 12.5% is exactly `1250`.
     *
     * Capped at 50%: above that the figure is almost certainly a mistake —
     * somebody typing a percentage where basis points were wanted — and a
     * mis-typed commission is invisible until the first payout.
     */
    commissionRateBps: z.int().min(0).max(5000).default(1500),
    status: z.enum(["active", "trial", "past_due", "suspended"]).default("trial"),
  })
  .strict()

export type OrgCreateInput = z.infer<typeof orgCreateSchema>

/** What an ADMIN may change afterwards — the platform's side of the deal. */
/**
 * How the platform collects this partner's commission (rules #91, #92).
 *
 * Its own endpoint, not a field on the general org update, and required with a
 * reason. Moving somebody to `invoice` means paying them in full and asking
 * for a share back — if they do not pay, the platform already has. That is a
 * decision somebody should have to state, and it lands in the audit log.
 */
export const settlementModeSchema = z
  .object({
    mode: z.enum(["deduct", "invoice"]),
    reason: z
      .string()
      .trim()
      .min(10, "Say why — this changes where the platform's money sits")
      .max(2000),
  })
  .strict()

export type SettlementModeInput = z.infer<typeof settlementModeSchema>

export const orgAdminUpdateSchema = orgCreateSchema.partial().strict()
export type OrgAdminUpdateInput = z.infer<typeof orgAdminUpdateSchema>

/* ------------------------------------------------------------------ team -- */

/**
 * Inviting somebody (rule #60).
 *
 * Only an email, a role, and which properties. Notably NOT a `userId`: the
 * person may not have an account yet, and taking one would mean the caller
 * choosing WHICH account joins their org.
 */
export const inviteCreateSchema = z
  .object({
    email: emailSchema,
    role: z.enum(PARTNER_ROLES).default("staff"),
    /** Empty = every property the org owns. */
    propertyIds: z.array(uuidSchema).max(200).default([]),
  })
  .strict()

export type InviteCreateInput = z.infer<typeof inviteCreateSchema>

export const inviteAcceptSchema = z
  .object({ token: z.string().trim().min(20).max(200) })
  .strict()

export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>

/**
 * Changing what a team member may do.
 *
 * `status` here is `active` or `suspended` only — `invited` is a state of an
 * INVITE, and a membership that exists was necessarily accepted. Offering it
 * would let somebody put a real member back into a state nothing can leave.
 */
export const memberUpdateSchema = z
  .object({
    role: z.enum(PARTNER_ROLES),
    propertyIds: z.array(uuidSchema).max(200),
    status: z.enum(["active", "suspended"]),
    /** What they do, not what they may do. Free text on purpose. */
    jobTitle: z.string().trim().max(80),
  })
  .partial()
  .strict()

export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>

/**
 * A team member as the extranet shows them.
 *
 * The person's name and email, because a team screen is for recognising
 * colleagues — and nothing else from their account.
 */
export type TeamMemberView = {
  id: string
  userId: string
  firstName: string
  lastName: string
  email: string
  /** Reachable, because a contacts screen that cannot be rung is a list. */
  phone: string
  /**
   * Their job, in their own words — separate from `role`, which is one of
   * three and decides what they may touch. "Revenue Manager" is not a
   * permission, and nobody wants to ring "the manager" meaning the night desk.
   */
  jobTitle: string
  role: PartnerMemberRole
  status: string
  propertyIds: string[]
  lastLoginAt: string | null
  createdAt: string
}

export type TeamInviteView = {
  id: string
  email: string
  role: PartnerMemberRole
  propertyIds: string[]
  expiresAt: string
  createdAt: string
}

/* ============================================================================
 * Module 15 — the agreements a partner signs (rule #98).
 * ========================================================================== */

export const CONTRACT_KINDS = ["service", "commission", "addendum", "policy"] as const
export type ContractKind = (typeof CONTRACT_KINDS)[number]

/** The platform publishing a version. Only the platform ever writes one. */
export const contractTemplateSchema = z
  .object({
    kind: z.enum(CONTRACT_KINDS),
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(200_000),
    effectiveFrom: isoDateSchema,
    /**
     * The version this replaces, if any.
     *
     * Given, the platform is saying "everyone on that one must re-accept".
     * Absent, this is simply a new agreement nobody has signed yet. The
     * difference matters and the API should not have to guess it.
     */
    supersedes: uuidSchema.optional(),
  })
  .strict()

export type ContractTemplateInput = z.infer<typeof contractTemplateSchema>

/**
 * A partner accepting.
 *
 * The name is typed by the person, not read off the account. Somebody signing
 * on behalf of a company should have written the name they are signing as, and
 * an auto-filled field is one nobody looked at.
 */
export const contractAcceptSchema = z
  .object({ acceptedByName: z.string().trim().min(2).max(160) })
  .strict()

export type ContractAcceptInput = z.infer<typeof contractAcceptSchema>

/** Ending an agreement. A reason, for the same reason a refund needs one. */
export const contractTerminateSchema = z
  .object({ reason: z.string().trim().min(10).max(2000) })
  .strict()

export type ContractTerminateInput = z.infer<typeof contractTerminateSchema>

export type ContractTemplateView = {
  id: string
  kind: ContractKind
  version: number
  title: string
  body: string
  active: boolean
  effectiveFrom: string
  createdAt: string
}

export type PartnerContractView = {
  id: string
  templateId: string
  kind: ContractKind
  version: number
  title: string
  /** The text as it was accepted, not as the template reads today. */
  body: string
  status: "accepted" | "superseded" | "terminated"
  acceptedAt: string
  acceptedByName: string
  expiresAt: string | null
  endedAt: string | null
  endedReason: string | null
}

/**
 * What this organisation still has to sign.
 *
 * `outstanding` is the active version of a kind they have not accepted — a new
 * partner's whole set, or the one version that replaced what they were on.
 */
export type PartnerContractsView = {
  signed: PartnerContractView[]
  outstanding: ContractTemplateView[]
}

/* ============================================================================
 * Platform settings (rule #106).
 * ========================================================================== */

/**
 * The two settings that actually do something.
 *
 * Everything the old screen offered besides these either belonged to deploy
 * configuration, described a product that does not exist, or was a switch for
 * something a runtime toggle cannot do. A settings form full of inert controls
 * is worse than a short one.
 */
export const platformSettingsSchema = z
  .object({
    supportEmail: emailSchema.optional(),
    /** Basis points. Applies to NEW organisations only, never to history. */
    defaultCommissionRateBps: z.coerce.number().int().min(0).max(10_000).optional(),
  })
  .strict()

export type PlatformSettingsInput = z.infer<typeof platformSettingsSchema>

export type PlatformSettingsView = {
  supportEmail: string
  defaultCommissionRateBps: number
  /** Read-only: every price in the system is USD cents. */
  currency: "USD"
  updatedAt: string
}
