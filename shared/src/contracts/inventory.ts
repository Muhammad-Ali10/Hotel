import { z } from "zod"

import type { Cents, ISODate, UUID } from "../types/common"
/*
 * The one place a contract reaches into the domain.
 *
 * `daysBetween` is date arithmetic, not a business rule, and re-implementing
 * it here to keep the layers tidy would put a second definition of "how many
 * days is that" in the codebase — which is the drift this package exists to
 * prevent. Safe in this direction: `domain/` never imports `contracts/`, so
 * there is no cycle.
 */
import { daysBetween } from "../domain/dates"
import { isoDateSchema, uuidSchema } from "./common"

/* ============================================================================
 * Inventory contracts (Module 3).
 * ========================================================================== */

/**
 * An availability query.
 *
 * Occupancy is `adults` + `children`, never one `guests` number (rule #28):
 * two adults plus two children is not the same request as four adults, and a
 * single figure cannot tell a room that sleeps 2+1 from one that sleeps 4.
 */
export const availabilitySearchSchema = z
  .object({
    checkIn: isoDateSchema,
    checkOut: isoDateSchema,
    adults: z.coerce.number().int().min(1).max(20).default(2),
    children: z.coerce.number().int().min(0).max(20).default(0),
  })
  .strict()
  .refine((v) => v.checkOut > v.checkIn, {
    message: "Check-out must be after check-in",
    path: ["checkOut"],
  })

export type AvailabilitySearchInput = z.infer<typeof availabilitySearchSchema>

/**
 * Bulk open/close (rule #32).
 *
 * `roomIds` omitted = every room of the property — the renovation case. There
 * is no separate property-closure table: one source of truth means the
 * availability query never has to consult two places.
 */
export const closeDatesSchema = z
  .object({
    propertyId: uuidSchema,
    /** Omit for the whole property. */
    roomIds: z.array(uuidSchema).max(200).optional(),
    from: isoDateSchema,
    to: isoDateSchema,
    isClosed: z.boolean(),
  })
  .strict()
  .refine((v) => v.to >= v.from, { message: "The range ends before it starts", path: ["to"] })

export type CloseDatesInput = z.infer<typeof closeDatesSchema>

/**
 * Sets rate and restrictions across a range.
 *
 * Every field is optional and `null`-able: omitting one leaves the existing
 * value alone, while sending `null` clears it back to the plan's default.
 * Without that distinction a partner could never remove a restriction they had
 * set by mistake.
 */
export const setRatesSchema = z
  .object({
    ratePlanId: uuidSchema,
    from: isoDateSchema,
    to: isoDateSchema,

    /** Cents. */
    rate: z.int().nonnegative().nullish(),
    minStay: z.int().min(1).max(365).nullish(),
    minStayThrough: z.int().min(1).max(365).nullish(),
    maxStay: z.int().min(1).max(365).nullish(),
    closedToArrival: z.boolean().nullish(),
    closedToDeparture: z.boolean().nullish(),
    minAdvanceHours: z.int().min(0).max(8760).nullish(),
  })
  .strict()
  .refine((v) => v.to >= v.from, { message: "The range ends before it starts", path: ["to"] })
  .refine(
    (v) =>
      v.minStay == null || v.maxStay == null || v.maxStay >= v.minStay,
    { message: "maxStay cannot be less than minStay", path: ["maxStay"] }
  )

export type SetRatesInput = z.infer<typeof setRatesSchema>

/* ============================================================================
 * The partner's own calendar (Module 3, the read side).
 *
 * The calendar could be written and never read back. A partner could set a
 * rate or close a date and had no way of seeing what was set — which is not a
 * missing screen so much as a missing answer to "what am I selling tomorrow".
 * ========================================================================== */

/** A year. Past that, `min_advance_hours` and seasons stop meaning anything. */
export const MAX_CALENDAR_DAYS = 365

export const calendarQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    /** Narrow to one room, or one rate plan within it. */
    roomId: uuidSchema.optional(),
    ratePlanId: uuidSchema.optional(),
  })
  .strict()
  .refine((v) => v.to >= v.from, {
    message: "The range cannot end before it starts",
    path: ["to"],
  })
  .refine((v) => daysBetween(v.from, v.to) < MAX_CALENDAR_DAYS, {
    // An unbounded range is rooms × plans × days of work for one request (API4).
    message: `Ask for at most ${MAX_CALENDAR_DAYS} days at a time`,
    path: ["to"],
  })

export type CalendarQueryInput = z.infer<typeof calendarQuerySchema>

/**
 * One night of one rate plan, as the guest would actually get it.
 *
 * Resolved through the same `resolveNight` the quote engine uses, so what a
 * partner reads here and what a guest is charged cannot disagree.
 */
export type CalendarRateNight = {
  date: ISODate
  rate: Cents
  minStay: number
  minStayThrough: number | null
  maxStay: number | null
  closedToArrival: boolean
  closedToDeparture: boolean
  minAdvanceHours: number | null
  /**
   * Whether a row exists for this date at all.
   *
   * The calendar is sparse, so most nights fall back to the rate plan's
   * defaults. Without this a partner cannot tell "I set this price" from "this
   * is simply the base price" — and every screen showing an override badge
   * needs exactly that distinction.
   */
  isOverridden: boolean
}

/** One night of one ROOM's stock. Shared by every rate plan on that room. */
export type CalendarStockNight = {
  date: ISODate
  totalUnits: number
  sellableUnits: number
  bookedUnits: number
  isClosed: boolean
  /** False when no row exists and the room's own `units` is standing in. */
  isMaterialised: boolean
}

export type CalendarRoom = {
  id: UUID
  name: string
  units: number
  status: string
  /** Stock lives on the ROOM — the two calendars are deliberately separate. */
  stock: CalendarStockNight[]
  ratePlans: {
    id: UUID
    name: string
    basePrice: Cents
    status: string
    nights: CalendarRateNight[]
  }[]
}

export type CalendarView = {
  from: ISODate
  to: ISODate
  rooms: CalendarRoom[]
}

/* ============================================================================
 * Copying a stretch of calendar (rule #100).
 * ========================================================================== */

/**
 * Copy a date range of rates onto another range.
 *
 * `targetRatePlanId` is optional and defaults to the source: the common job is
 * "last June onto this June, same rate plan", and making the partner name the
 * plan twice is a chance to name the wrong one.
 *
 * The two ranges do NOT have to be the same length. A shorter source repeats
 * across a longer target, which is the whole point — copying a typical week
 * over a season is why this screen exists.
 */
export const copyRatesSchema = z
  .object({
    sourceRatePlanId: uuidSchema,
    targetRatePlanId: uuidSchema.optional(),
    sourceFrom: isoDateSchema,
    sourceTo: isoDateSchema,
    targetFrom: isoDateSchema,
    targetTo: isoDateSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.sourceTo < value.sourceFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceTo"],
        message: "The source range ends before it starts",
      })
    }
    if (value.targetTo < value.targetFrom) {
      ctx.addIssue({
        code: "custom",
        path: ["targetTo"],
        message: "The target range ends before it starts",
      })
    }
  })

export type CopyRatesInput = z.infer<typeof copyRatesSchema>

/** How much calendar one copy may touch. A year at a time, like `setRates`. */
export const COPY_RATES_MAX_DAYS = 366
