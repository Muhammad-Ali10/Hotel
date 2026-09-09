import { z } from "zod"

import { isoDateSchema, uuidSchema } from "./common"

/* ============================================================================
 * The platform's own surface (Module 11, rules #76–#81).
 * ========================================================================== */

/* -------------------------------------------------------- reservations -- */

export const adminBookingSearchSchema = z
  .object({
    /** Reference, guest email or guest name — one box, like the screen has. */
    q: z.string().trim().max(160).optional(),
    status: z
      .enum(["pending", "confirmed", "checked_in", "completed", "cancelled", "no_show"])
      .optional(),
    propertyId: uuidSchema.optional(),
    customerId: uuidSchema.optional(),
    /** By BOOKING date — the question support is answering is "when was this made". */
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    /** Keyset cursor: the `created_at` of the last row seen. */
    before: z.string().max(64).optional(),
  })
  .strict()

export type AdminBookingSearchInput = z.infer<typeof adminBookingSearchSchema>

/**
 * An announcement an administrator sends to customers.
 *
 * The text is written here rather than derived from a promotion, because the
 * template is exactly a subject and a body — pretending it is generated from
 * a discount would mean inventing sentences nobody wrote.
 *
 * Who receives it is NOT a parameter, and deliberately: the audience is every
 * customer whose account is active, whose address is verified, and who has
 * marketing messages switched on. Letting the caller widen that is the one
 * thing this endpoint must not allow — consent is not an option on a form.
 */
export const adminOfferSchema = z
  .object({
    title: z.string().trim().min(3).max(160),
    body: z.string().trim().min(10).max(4000),
  })
  .strict()

export type AdminOfferInput = z.infer<typeof adminOfferSchema>

/**
 * A platform refund (rules #76, #78).
 *
 * `amount` is in CENTS and required — there is no "refund everything" flag,
 * because a person authorising money leaving should have typed the number.
 *
 * `reason` is required and has a floor: "ok" is not a reason, and the whole
 * point of recording one is that somebody later can understand the decision.
 */
export const adminRefundSchema = z
  .object({
    amount: z.int().positive(),
    reason: z.string().trim().min(10, "Say why — this cannot be undone").max(2000),
  })
  .strict()

export type AdminRefundRequest = z.infer<typeof adminRefundSchema>

/**
 * Forcing a booking to another status.
 *
 * The transition itself is still checked by `canTransition` — this only says
 * the actor is the platform. An admin may move a booking a guest could not,
 * but not to a status the machine has no edge to (rule #6).
 */
export const adminTransitionSchema = z
  .object({
    to: z.enum(["confirmed", "checked_in", "completed", "no_show", "cancelled"]),
    reason: z.string().trim().min(10, "Say why — this cannot be undone").max(2000),
  })
  .strict()

export type AdminTransitionInput = z.infer<typeof adminTransitionSchema>

/* --------------------------------------------------------------- users -- */

export const adminUserSearchSchema = z
  .object({
    q: z.string().trim().max(160).optional(),
    role: z.enum(["customer", "partner", "admin"]).optional(),
    status: z.enum(["active", "suspended"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.string().max(64).optional(),
  })
  .strict()

export type AdminUserSearchInput = z.infer<typeof adminUserSearchSchema>

/**
 * Changing what an account may do (rule #79).
 *
 * No `delete`. Bookings, reviews and payouts all point at a user, and removing
 * one makes every record they touched anonymous. `suspended` stops them
 * signing in, which is the thing actually wanted.
 */
export const adminUserUpdateSchema = z
  .object({
    role: z.enum(["customer", "partner", "admin"]),
    status: z.enum(["active", "suspended"]),
    reason: z.string().trim().min(10, "Say why — this changes what they can reach").max(2000),
  })
  .partial({ role: true, status: true })
  .strict()
  .refine((v) => v.role !== undefined || v.status !== undefined, {
    message: "Nothing to change",
  })

export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>

/* --------------------------------------------------------------- audit -- */

export const auditSearchSchema = z
  .object({
    subjectType: z
      .enum(["booking", "user", "property", "partner_org", "payout", "review", "promotion"])
      .optional(),
    subjectId: uuidSchema.optional(),
    actorId: uuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    before: z.string().max(64).optional(),
  })
  .strict()

export type AuditSearchInput = z.infer<typeof auditSearchSchema>

export type AuditLineView = {
  id: string
  actorId: string | null
  actorEmail: string
  action: string
  subjectType: string
  subjectId: string | null
  reason: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

/* -------------------------------------------------------------- guests -- */

/**
 * What the platform may see of a guest (rule #80).
 *
 * Enough to answer a complaint, and no more. There is no password hash here —
 * it lives in its own table precisely so a profile query cannot return one —
 * and no card details, which this system has never held (rule #43).
 */
export type AdminGuestView = {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  country: string
  role: string
  status: string
  tier: string
  emailVerified: boolean
  createdAt: string
  stats: {
    bookings: number
    completed: number
    cancelled: number
    /** Lifetime, in cents, across realised bookings only. */
    spend: number
    reviews: number
  }
}
