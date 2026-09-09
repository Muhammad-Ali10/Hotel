import { z } from "zod"

import { emailSchema, isoDateSchema } from "./common"

/* ============================================================================
 * Booking contracts (Module 5).
 * ========================================================================== */

/**
 * Creating a booking.
 *
 * Note what is ABSENT: no price, no total, no dates, no room. All of that is
 * inside the signed quote token, which this server issued — so a tampered body
 * cannot buy a cheap stay, and the guest is charged exactly what they were
 * shown (rule #13).
 */
export const createBookingSchema = z
  .object({
    quoteToken: z.string().min(20).max(4096),
    guest: z
      .object({
        firstName: z.string().trim().min(1).max(80),
        lastName: z.string().trim().min(1).max(80),
        email: emailSchema,
        phone: z.string().trim().max(32).default(""),
        country: z.string().trim().max(80).default(""),
      })
      .strict(),
    arrivalTime: z.string().max(40).default(""),
    specialRequests: z.string().max(2000).default(""),
    /*
     * There is no payment field here any more (rule #42).
     *
     * The prototype let the client send `paymentMethod`, and "pay at the
     * property" meant no card at all — so a caller could opt out of paying by
     * setting a string. The mode now comes from the rate plan, server-side,
     * exactly like the price and the cancellation terms.
     */
  })
  .strict()

export type CreateBookingInput = z.infer<typeof createBookingSchema>

/**
 * The frozen price block, as it comes BACK out of the database.
 *
 * `bookings.pricing` is JSONB, which means it arrives as `unknown` — and
 * casting it straight to `BookingPricing` would let a malformed or
 * older-shaped row flow into `refundFor` and produce a wrong refund with no
 * error anywhere. This is the boundary where untyped storage becomes a typed
 * value, so it is parsed rather than asserted.
 */
export const bookingPricingSchema = z
  .object({
    nights: z.int().nonnegative(),
    nightlyRates: z.array(z.int().nonnegative()),
    ratePerNight: z.int().nonnegative(),
    roomSubtotal: z.int().nonnegative(),
    addOnsTotal: z.int().nonnegative(),
    discount: z
      .object({ id: z.string(), label: z.string(), amount: z.int() })
      .optional(),
    total: z.int().nonnegative(),
  })
  .strict()

/**
 * The cancellation terms frozen onto a booking.
 *
 * Stored as three plain columns, so they come back as loose strings. Parsing
 * them keeps an unrecognised value from reaching `refundFor`, where an unknown
 * `charge` would fall through its switch and silently refund everything.
 */
export const storedCancellationPolicySchema = z
  .object({
    freeUntil: z.enum(["6pm_arrival", "24h", "48h", "7d", "14d", "non_refundable"]),
    charge: z.enum(["first_night", "percent", "full"]),
    chargeValue: z.int().min(1).max(100).nullable(),
    /** Rule #47. `null` means a no-show costs what a late cancellation costs. */
    noShowCharge: z.enum(["first_night", "percent", "full"]).nullable().default(null),
    noShowChargeValue: z.int().min(1).max(100).nullable().default(null),
  })
  .strict()

/**
 * Changing a booking's dates or party size (rule #38).
 *
 * Just a quote token: the new dates, occupancy and price all live inside it,
 * signed. The client cannot describe the change in its own words, so it cannot
 * describe it wrongly — and the new price is one this server produced.
 */
export const modifyBookingSchema = z
  .object({
    quoteToken: z.string().min(20).max(4096),
  })
  .strict()

export type ModifyBookingInput = z.infer<typeof modifyBookingSchema>

/* ---------------------------------------------------------------- listing -- */

/**
 * Paging the two booking lists.
 *
 * Both used to answer with a bare array capped in the service — 100 for a
 * guest, 200 for a partner — with no cursor and nothing in the response to say
 * more existed. A partner with 201 reservations saw 200 and had no way to know,
 * which is the failure mode a cap without a cursor always has: it looks like an
 * answer.
 *
 * `limit` is capped at 100 here as well, but now the cap is a PAGE, not the
 * whole truth.
 */
export const bookingListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    /** Opaque. Built by the server, handed back unchanged. */
    cursor: z.string().max(256).optional(),
  })
  .strict()

export type BookingListQuery = z.infer<typeof bookingListQuerySchema>

/**
 * The partner list, which is a work queue rather than a history.
 *
 * The filters are here because the extranet already draws these views by
 * pulling every row and filtering in the browser — which is the same silent
 * truncation one layer up, and gets slower for the partner who has the most
 * to lose by it.
 */
export const partnerBookingListQuerySchema = bookingListQuerySchema.extend({
  status: z
    .enum(["pending", "confirmed", "checked_in", "completed", "cancelled", "no_show"])
    .optional(),
  /** By STAY date, not booking date: a front desk asks "who arrives this week". */
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
})

export type PartnerBookingListQuery = z.infer<typeof partnerBookingListQuerySchema>

export const cancelBookingSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict()

export type CancelBookingInput = z.infer<typeof cancelBookingSchema>

/**
 * A status move.
 *
 * Only the states a person can drive to are listed: `pending` and `cancelled`
 * are absent because neither is something to "set" — a booking becomes pending
 * by being created and cancelled through its own endpoint, which has a refund
 * to compute.
 */
export const setBookingStatusSchema = z
  .object({
    status: z.enum(["confirmed", "checked_in", "completed", "no_show"]),
    roomNo: z.string().trim().max(20).optional(),
  })
  .strict()

export type SetBookingStatusInput = z.infer<typeof setBookingStatusSchema>

/** Returned with a 409 when the last room went in the final second (rule #24). */
export const JUST_SOLD_OUT_CODE = "just_sold_out"
