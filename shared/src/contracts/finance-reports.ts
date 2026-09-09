import { z } from "zod"

import { isoDateSchema, uuidSchema } from "./common"
import { ANALYTICS_GRANULARITIES, MAX_RANGE_DAYS } from "./analytics"

/* ============================================================================
 * The money screens — extranet `finance/*` and admin `finance/*` (rule #97).
 *
 * Three words, and they never mean each other:
 *
 *   gross       what the guest paid
 *   commission  what the platform earned  (rule #82)
 *   net         what the property keeps   (gross - commission)
 *
 * The prototype called both the first and the third "revenue". One screen then
 * shows a number 12% larger than another screen showing the same thing, and
 * whoever is reconciling has no way to tell which one is lying.
 * ========================================================================== */

/** The window and the shape of a finance report. */
export const financeRangeSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    /**
     * One property, for a partner who runs several. Intersected with what the
     * session already allows — never trusted on its own.
     */
    propertyId: uuidSchema.optional(),
    granularity: z.enum(ANALYTICS_GRANULARITIES).default("month"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.to < value.from) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "`to` cannot be before `from`" })
      return
    }
    const days =
      (Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`)) / 86_400_000
    if (days > MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `Range cannot exceed ${MAX_RANGE_DAYS} days`,
      })
    }
  })

export type FinanceRangeInput = z.infer<typeof financeRangeSchema>

/** The platform's version: no property, an optional organisation instead. */
export const platformFinanceRangeSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    /** Narrow to one partner organisation. Absent = the whole marketplace. */
    orgId: uuidSchema.optional(),
    granularity: z.enum(ANALYTICS_GRANULARITIES).default("month"),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.to < value.from) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "`to` cannot be before `from`" })
      return
    }
    const days =
      (Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`)) / 86_400_000
    if (days > MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `Range cannot exceed ${MAX_RANGE_DAYS} days`,
      })
    }
  })

export type PlatformFinanceRangeInput = z.infer<typeof platformFinanceRangeSchema>

/** The transaction ledger, paged. */
export const transactionsQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    propertyId: uuidSchema.optional(),
    orgId: uuidSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    /** Keyset cursor: the `bookedAt` of the last row seen. */
    before: z.string().max(64).optional(),
  })
  .strict()

export type TransactionsQueryInput = z.infer<typeof transactionsQuerySchema>

/* --------------------------------------------------------------- outputs -- */

/** Every finance figure, in the three words that never mean each other. */
export type MoneyTotals = {
  bookings: number
  gross: number
  commission: number
  net: number
  cancelled: number
  refunded: number
}

/**
 * The finance landing screen.
 *
 * `pendingPayouts` and `outstandingInvoices` are NOT netted together: one is
 * what the platform owes the partner, the other what the partner owes the
 * platform. A single figure hides which way the money is going.
 */
export type FinanceOverview = MoneyTotals & {
  /** The same window, one period earlier — for a delta the client can render. */
  previous: MoneyTotals
  /** Weighted average across the window, in basis points. */
  effectiveRateBps: number
  /**
   * The rate on file, which is not the same question.
   *
   * `effectiveRateBps` is what actually happened in this window; a partner
   * with no bookings yet would read that as zero and conclude they keep
   * everything. Both, so neither can be mistaken for the other.
   *
   * Absent on the platform-wide view: there is no one rate across a
   * marketplace, and inventing one would describe nobody.
   */
  commissionRateBps?: number
  pendingPayouts: { amount: number; count: number }
  outstandingInvoices: { amount: number; count: number }
  /** How commission is collected today (rules #91–#93). Absent for platform. */
  settlementMode?: "deduct" | "invoice"
  payoutsHeld?: boolean
}

export type FinanceTrendPoint = MoneyTotals & { period: string }

export type FinanceRevenueView = {
  granularity: (typeof ANALYTICS_GRANULARITIES)[number]
  totals: MoneyTotals
  points: FinanceTrendPoint[]
  byProperty: (MoneyTotals & {
    propertyId: string
    propertyName: string
    city: string
  })[]
}

export type CommissionReportRow = MoneyTotals & {
  /** `YYYY-MM`. */
  month: string
  propertyId: string
  propertyName: string
  orgId: string
  orgName: string
  /**
   * The rate actually achieved, weighted by booking value — not the rate on
   * the organisation today. A renegotiation mid-month really did produce two
   * rates, and showing today's against last month's money will not reconcile.
   */
  rateBps: number
}

export type FinanceTransaction = {
  bookingId: string
  ref: string
  bookedAt: string
  checkIn: string
  checkOut: string
  guestName: string
  propertyId: string
  propertyName: string
  roomName: string
  gross: number
  /** Zero once a goodwill refund has voided it (rule #76). */
  commission: number
  net: number
  refunded: number
  paymentMode: "prepay" | "guarantee"
  source: string
  status: string
}
