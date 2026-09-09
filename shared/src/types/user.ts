import type { ISODate, ISODateTime, ImageSeed, Timestamps, UUID } from "./common"

/* ------------------------------------------------------------------ user -- */

/**
 * Platform-level role. A person is one of these; partner-side permissions are a
 * separate axis carried by `PartnerMember.role`.
 */
export type UserRole = "customer" | "partner" | "admin"

/**
 * Loyalty tier. This is the ONLY field that drives pricing — a `genius`
 * promotion matches on it (rule #3). `membership` below is display text.
 */
export type UserTier = "standard" | "genius"

export type UserStatus = "active" | "suspended" | "blocked"

export type User = Timestamps & {
  id: UUID
  email: string
  role: UserRole
  status: UserStatus

  /**
   * Kept split, never a single `name`. The admin panel flattened these to one
   * string, which makes "Dear John," impossible to render without guessing
   * where the first name ends.
   */
  firstName: string
  lastName: string

  phone: string
  country: string
  city: string
  avatarSeed: ImageSeed

  tier: UserTier

  /**
   * Display label only ("Gold Member"). NOT the pricing tier.
   *
   * `points` likewise has no earn/spend logic anywhere yet — the prototype
   * showed 12,450 on the profile and nothing ever changed it, while the public
   * cancellation page promises "reward points … are returned to your account".
   * Both are carried forward so the data is not lost, but a loyalty module has
   * to define them before they mean anything.
   */
  membership: string
  points: number

  joinedAt: ISODate
  preferences: string[]

  emailVerifiedAt: ISODateTime | null
  lastLoginAt: ISODateTime | null
}

/** Never leaves the backend. Kept out of every DTO. */
export type UserCredentials = {
  userId: UUID
  /** argon2id — see docs/ARCHITECTURE.md §5 API2. */
  passwordHash: string
}

export type UserSettings = {
  userId: UUID
  emailNotifications: boolean
  smsNotifications: boolean
  marketing: boolean
  twoFactor: boolean
  /** Display preference only — the platform settles in USD (rule #12). */
  currency: string
  language: string
}

/* --------------------------------------------------------------- partner -- */

export type PlanTier = "starter" | "professional" | "enterprise"

export type PartnerOrgStatus = "active" | "trial" | "past_due" | "suspended"

/**
 * The company behind one or more properties — "Aurora Hospitality" in the
 * fixtures. Only the admin panel modelled this (as `Client`); the core types
 * had no concept of it at all, which is why a partner's properties and their
 * billing lived in two disconnected worlds.
 */
export type PartnerOrg = Timestamps & {
  id: UUID
  name: string
  status: PartnerOrgStatus
  planTier: PlanTier

  /**
   * Commission in BASIS POINTS — 1500 = 15.00% (rule #20).
   *
   * Basis points, not a decimal fraction, for the same reason money is cents:
   * `0.15` is a float and floats do not belong anywhere near a ledger. Integer
   * bps also lets a negotiated 12.5% be expressed exactly (1250).
   *
   * Defaults come from `planTier`, but the column is per-org so a rate can be
   * negotiated without a code change. The prototype had a single hardcoded
   * `COMMISSION_RATE = 0.15` while also modelling three plan tiers that meant
   * nothing.
   */
  commissionRateBps: number

  contactEmail: string
  contactPhone: string
  country: string
}

// Plan-tier commission defaults live in `domain/commission.ts` — they are a
// business rule, not a type.

/**
 * Permission level, NOT a job title (rule #14).
 *
 * The admin panel used five job titles (Owner / General Manager / Revenue
 * Manager / Front Desk Manager / Staff) while the extranet used three
 * permission levels. Three wins: a new job title should not require an enum
 * migration, and the permission matrix stays three rows instead of five.
 */
export type PartnerRole = "admin" | "manager" | "staff"

export type PartnerMemberStatus = "active" | "invited" | "suspended"

export type PartnerMember = Timestamps & {
  id: UUID
  orgId: UUID
  userId: UUID
  role: PartnerRole
  status: PartnerMemberStatus

  /**
   * Which properties this member may touch. **Empty array = all of the org's
   * properties.**
   *
   * Two independent checks guard every partner request: `role` decides WHAT
   * they may do, `propertyIds` decides WHICH properties they may do it to.
   * See docs/ARCHITECTURE.md §5 (API1 tenant isolation, API5 function-level).
   */
  propertyIds: UUID[]

  invitedAt: ISODateTime
  lastLoginAt: ISODateTime | null
}
