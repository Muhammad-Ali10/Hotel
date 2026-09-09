import { z } from "zod"

import type { BookWindowKey } from "../domain/analytics"
import { isoDateSchema, uuidSchema } from "./common"

/* ============================================================================
 * Analytics (Module 10, rules #62–#68).
 *
 * Every screen takes the same range, so the range is one schema. The two date
 * bases — stay date and booking date (rule #62) — are a property of each
 * endpoint, not something a caller chooses: "occupancy by booking date" is not
 * a slower answer, it is a meaningless one.
 * ========================================================================== */

/**
 * The longest range any screen may ask for (API4).
 *
 * Two years, so year-on-year comparison fits with room to spare. Without a
 * ceiling a single request can be made to scan every booking the platform has
 * ever taken, which is a denial of service that looks exactly like a curious
 * hotelier dragging a date picker.
 */
export const MAX_RANGE_DAYS = 731

export const analyticsRangeSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    /** Absent = every property the caller may see. */
    propertyId: uuidSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.to < value.from) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "`to` cannot be before `from`",
      })
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

export type AnalyticsRangeInput = z.infer<typeof analyticsRangeSchema>

export const ANALYTICS_GRANULARITIES = ["day", "week", "month"] as const
export type AnalyticsGranularity = (typeof ANALYTICS_GRANULARITIES)[number]

/**
 * A trend query.
 *
 * Built by extending the range object BEFORE its refinement, then re-applying
 * the same checks — `.extend()` on a refined schema is not available in zod 4,
 * and wrapping instead of rebuilding would silently drop the range ceiling.
 */
export const analyticsTrendSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    propertyId: uuidSchema.optional(),
    granularity: z.enum(ANALYTICS_GRANULARITIES).default("day"),
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

export type AnalyticsTrendInput = z.infer<typeof analyticsTrendSchema>

/* --------------------------------------------------------------- outputs -- */

/**
 * Money on an analytics response.
 *
 * `null` — not zero, not absent — when the caller is `staff` (rule #66). Zero
 * would read as "no revenue", which is a different and alarming statement, and
 * dropping the key entirely makes every consumer's types conditional on a role
 * they cannot see.
 */
export type MaybeCents = number | null

export type SalesPoint = {
  /** Period start, ISO date. Bucketed by BOOKING date (rule #62). */
  period: string
  bookings: number
  revenue: MaybeCents
  commission: MaybeCents
}

export type SalesView = {
  granularity: AnalyticsGranularity
  points: SalesPoint[]
  totals: {
    bookings: number
    revenue: MaybeCents
    commission: MaybeCents
    /** Cancellation and no-show fees — revenue, but no room was sold (#63). */
    fees: MaybeCents
    cancelled: number
  }
  /** Same-length window immediately before `from`, for the deltas. */
  previous: {
    bookings: number
    revenue: MaybeCents
  }
}

export type PerformanceRowView = {
  propertyId: string
  property: string
  /** Room-nights sold in the range, by STAY date (rule #62). */
  roomNights: number
  roomNightsAvailable: number
  bookings: number
  revenue: MaybeCents
  adr: MaybeCents
  revpar: MaybeCents
  /** `0`–`1`. */
  occupancy: number
  /** Average review score on the product's only scale, 1–5. `null` when never reviewed. */
  score: number | null
  reviews: number
}

export type PaceView = {
  /** Nights already stayed inside the range, by stay date. */
  completed: {
    period: string
    bookings: number
    roomNights: number
    revenue: MaybeCents
    adr: MaybeCents
    occupancy: number
  }[]
  /**
   * On the books for future stay dates, against the same point last year.
   *
   * `lastYear` is what was ALREADY BOOKED by this day a year ago, not what the
   * year eventually became — comparing today's partial book against last
   * year's finished one would show every property collapsing.
   */
  future: {
    period: string
    bookedNow: number
    lastYear: number
    revenue: MaybeCents
  }[]
}

export type CancellationsView = {
  total: number
  /** Of every booking made in the range, the fraction later cancelled. */
  rate: number
  noShows: number
  /** Mean days between cancelling and the stay starting. */
  avgDaysBefore: number | null
  feesCharged: MaybeCents
  refunded: MaybeCents
  byReason: {
    reason: string
    count: number
    share: number
    avgDaysBefore: number | null
  }[]
  byActor: { actor: string; count: number }[]
}

export type BookWindowView = {
  buckets: {
    key: BookWindowKey
    label: string
    bookings: number
    share: number
    avgRate: MaybeCents
    /** Fraction of this bucket's bookings that were later cancelled. */
    cancelRate: number
  }[]
  /** Median rather than mean — the distribution has two humps. */
  medianLeadDays: number | null
}

export type BookerSegmentView = {
  segment: string
  bookings: number
  share: number
  avgSpend: MaybeCents
  avgStay: number
  topSource: string
}

export type BookersView = {
  byCountry: BookerSegmentView[]
  byParty: BookerSegmentView[]
  bySource: BookerSegmentView[]
  /** Guests with more than one booking, over guests with any. */
  repeatRate: number
}

export type GeniusView = {
  bookings: number
  totalBookings: number
  share: number
  revenue: MaybeCents
  adr: MaybeCents
  nonGeniusAdr: MaybeCents
  /** What the tier gave away, in cents. */
  discountGiven: MaybeCents
  guests: number
}

/**
 * How a property sits against its market (rule #65).
 *
 * Every market figure is nullable and every one of them is `null` together —
 * when fewer than `MARKET_MIN_SAMPLE` properties contribute, nothing is
 * published, because an average over two properties is one subtraction away
 * from the competitor's exact rate.
 */
export type ComparablesView = {
  city: string
  sample: number
  suppressed: boolean
  mine: { adr: MaybeCents; occupancy: number; score: number | null }
  market: { adr: MaybeCents; occupancy: number | null; score: number | null }
  /** Fractions: `0.08` is "8% above market". `null` when suppressed. */
  versus: { adr: number | null; occupancy: number | null; score: number | null }
}

/* -------------------------------------------------------- search events -- */

/**
 * A click on a search result (rule #67).
 *
 * Sent by the browser, so it is the one analytics write a client can reach.
 * The pair is the whole body: which search, which property.
 */
export const searchClickSchema = z.object({ propertyId: uuidSchema }).strict()
export type SearchClickInput = z.infer<typeof searchClickSchema>

/* ============================================================================
 * The platform's own view (Module 11, rules #82–#84).
 * ========================================================================== */

export const platformRangeSchema = z
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

export type PlatformRangeInput = z.infer<typeof platformRangeSchema>

/**
 * What the platform actually earned, beside what passed through it (rule #82).
 *
 * `gmv` is the guests' money and mostly the property's. `revenue` is the
 * COMMISSION — the platform's own. Keeping them in separate fields with
 * separate names is what stops a dashboard presenting one as the other, which
 * would make growth, margin and take rate all wrong at once.
 */
export type PlatformOverview = {
  /** Gross booking value — passed through, not earned. */
  gmv: number
  /** The platform's own revenue: commission, net of anything voided (#76). */
  revenue: number
  /** `revenue ÷ gmv` for the same window, or `null` when nothing traded (#83). */
  takeRate: number | null
  bookings: number
  cancelled: number
  /** Cancellation and no-show fees the properties kept. */
  fees: number
  shape: {
    orgs: number
    activeOrgs: number
    properties: number
    liveProperties: number
  }
  /** The same-length window immediately before, for the deltas. */
  previous: {
    gmv: number
    revenue: number
    bookings: number
  }
}

export type PlatformClientRow = {
  orgId: string
  orgName: string
  properties: number
  bookings: number
  cancelled: number
  gmv: number
  revenue: number
  /** This client's share of the platform's commission in the window. */
  share: number
  takeRate: number | null
}
