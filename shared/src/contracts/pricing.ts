import { z } from "zod"

import { isoDateSchema, uuidSchema } from "./common"

/* ============================================================================
 * Pricing contracts (Module 4).
 * ========================================================================== */

/**
 * A quote request.
 *
 * Note what is ABSENT: no price, no total, no discount, no promotion id. The
 * client says WHAT it wants and the server decides what that costs. A body
 * that could carry a total would eventually be trusted by something.
 *
 * The channel is absent for the same reason — `mobile` is derived from the
 * user agent and `genius` from the session, both server-side (rule #3).
 */
export const quoteRequestSchema = z
  .object({
    roomId: uuidSchema,
    ratePlanId: uuidSchema,
    checkIn: isoDateSchema,
    checkOut: isoDateSchema,
    adults: z.int().min(1).max(20).default(2),
    children: z.int().min(0).max(20).default(0),
    addOns: z
      .array(
        z
          .object({
            valueAddId: uuidSchema,
            qty: z.int().min(1).max(20),
          })
          .strict()
      )
      .max(20)
      .default([]),

    /**
     * Set when re-quoting a booking that is being MOVED.
     *
     * Its own held nights are then excluded from the availability check, so a
     * stay shifting by one night is not blocked by itself. Ownership is
     * verified server-side before anything is excluded — an id that is not the
     * caller's simply has no effect.
     */
    modifyBookingId: uuidSchema.optional(),
  })
  .strict()
  .refine((v) => v.checkOut > v.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  })
  .refine(
    (v) => new Set(v.addOns.map((a) => a.valueAddId)).size === v.addOns.length,
    { message: "The same extra cannot be listed twice", path: ["addOns"] }
  )

export type QuoteRequestInput = z.infer<typeof quoteRequestSchema>

/**
 * The error code a client should act on rather than display.
 *
 * An expired quote is not a failure to show the guest — the right response is
 * to fetch a fresh one and carry on.
 */
export const QUOTE_EXPIRED_CODE = "quote_expired"
