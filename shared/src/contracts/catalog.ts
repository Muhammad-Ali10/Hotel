import { z } from "zod"

import type { Cents, UUID } from "../types/common"
import type {
  CancellationPolicy,
  PropertyStatus,
  PropertyType,
  ValueAddUnit,
} from "../types/property"
import type { PropertyRating } from "../types/review"
import { centsSchema, isoDateSchema, paginationSchema, uuidSchema } from "./common"

/**
 * The property types, as a zod enum.
 *
 * Spelled out beside the type rather than derived from it: `PropertyType` is a
 * compile-time thing and a query parameter arrives at runtime. The satisfies
 * clause keeps the two from drifting — adding a type without adding it here
 * stops compiling, which is exactly what did NOT happen when the registration
 * wizard grew six types the database had never heard of.
 */
export const PROPERTY_TYPE_VALUES = [
  "hotel",
  "resort",
  "guesthouse",
  "hostel",
  "apartment",
  "villa",
  "bnb",
  "motel",
] as const satisfies readonly PropertyType[]

/* ============================================================================
 * Catalogue contracts (Module 2).
 *
 * Deliberately NO date parameters. Filtering by availability needs the
 * inventory calendar, which is Module 3 — mixing the two here would put half
 * of one module's logic inside another's.
 * ========================================================================== */

/**
 * `recommended` first, and it is the default (rule #104).
 *
 * It used to be absent, so `recommended` on the search page quietly fell back
 * to `price_asc` — a marketplace whose default order was "cheapest" and whose
 * label said something else.
 */
export const PROPERTY_SORTS = ["recommended", "price_asc", "price_desc", "name_asc"] as const
export type PropertySort = (typeof PROPERTY_SORTS)[number]

export const propertySearchSchema = paginationSchema
  .extend({
    city: z.string().trim().min(1).max(120).optional(),
    country: z.string().trim().min(1).max(80).optional(),
    type: z.enum(PROPERTY_TYPE_VALUES).optional(),

    /** Cents. Both bounds are inclusive. */
    minPrice: z.coerce.number().int().nonnegative().optional(),
    maxPrice: z.coerce.number().int().nonnegative().optional(),

    minStars: z.coerce.number().int().min(1).max(5).optional(),

    /**
     * Amenity SLUGS, and a property must have them all.
     *
     * Slugs rather than labels because the vocabulary is controlled
     * (rule #31): matching on display text is how "WiFi" and "Free Wi-Fi"
     * become two different filters that each miss half the catalogue.
     */
    amenities: z
      .union([z.string(), z.array(z.string())])
      .transform((v) => (Array.isArray(v) ? v : [v]))
      .pipe(z.array(z.string().max(64)).max(20))
      .optional(),

    /* ------------------------------------------------------------ dates -- */

    /*
     * When the stay is, and who is coming.
     *
     * Search had none of these, which meant it answered a different question
     * from the one people were asking: it listed hotels that MATCHED, not
     * hotels that were AVAILABLE. A guest filtered to five stars in New York,
     * picked one, and found out on the property page that it was full for
     * their week — after choosing it.
     *
     * All four are optional together. Browsing without dates is a real thing
     * to do and still works exactly as it did; the availability filter only
     * applies once somebody says when.
     */
    checkIn: isoDateSchema.optional(),
    checkOut: isoDateSchema.optional(),
    adults: z.coerce.number().int().min(1).max(20).optional(),
    children: z.coerce.number().int().min(0).max(20).optional(),

    sort: z.enum(PROPERTY_SORTS).default("recommended"),
  })
  .superRefine((value, ctx) => {
    /*
     * Both dates or neither, and in the right order.
     *
     * A half-specified range is the shape that silently does nothing: one date
     * alone cannot filter availability, so the request would come back looking
     * exactly like a successful search over every hotel — which is how a guest
     * ends up booking a room that was never free.
     */
    const given = [value.checkIn, value.checkOut].filter(Boolean).length
    if (given === 1) {
      ctx.addIssue({
        code: "custom",
        path: [value.checkIn ? "checkOut" : "checkIn"],
        message: "Give both dates or neither",
      })
    }
    if (value.checkIn && value.checkOut && value.checkOut <= value.checkIn) {
      ctx.addIssue({
        code: "custom",
        path: ["checkOut"],
        message: "Check-out must be after check-in",
      })
    }
  })
  .strict()
  .refine(
    (v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice,
    { message: "minPrice cannot be greater than maxPrice", path: ["minPrice"] }
  )

export type PropertySearchInput = z.infer<typeof propertySearchSchema>

/* --------------------------------------------------------------- outputs -- */

/**
 * What a listing card needs — and nothing more.
 *
 * No rooms, no policies, no rate plans. A card that carries the whole property
 * makes the list query join everything for results the guest will scroll past.
 */
export type PropertyListItem = {
  id: UUID
  slug: string
  name: string
  city: string
  country: string
  type: PropertyType
  stars: number | null
  /** Cheapest active rate plan, in cents. */
  fromPrice: Cents
  amenities: string[]
  /**
   * Derived from published reviews on every read, never stored (rule #40) —
   * so a moderation decision moves the card the moment it is made.
   */
  rating: PropertyRating
  seed: string
}

export type RatePlanSummary = {
  id: UUID
  name: string
  basePrice: Cents
  cancellation: CancellationPolicy
  /** Generated from the policy — never stored, so it cannot drift (rule #1). */
  cancellationText: string
  inclusions: string[]
  minStay: number
  isDefault: boolean
  /**
   * Whether picking this rate charges the card today (rule #42).
   *
   * `prepay` takes the money now; `guarantee` only holds the card and settles
   * at the property. The guest is choosing between rates partly ON this, so it
   * belongs in the public detail — the rate plan decides it and the client can
   * never override it, but hiding it makes the choice uninformed.
   */
  paymentMode: "prepay" | "guarantee"
}

export type RoomDetail = {
  id: UUID
  name: string
  description: string
  maxAdults: number
  maxChildren: number
  maxOccupancy: number
  bed: string
  size: number
  features: string[]
  units: number
  seed: string
  ratePlans: RatePlanSummary[]
}

export type PropertyDetail = {
  id: UUID
  slug: string
  name: string
  city: string
  country: string
  address: string
  timezone: string
  type: PropertyType
  stars: number | null
  description: string
  fromPrice: Cents
  amenities: { slug: string; label: string; category: string; icon: string }[]
  policies: {
    checkInTime: string
    checkOutTime: string
    payment: string
    pets: string
    smoking: string
    children: string
  }
  rooms: RoomDetail[]
  photos: { id: UUID; category: string; caption: string; seed: string }[]
  valueAdds: { id: UUID; name: string; category: string; description: string; price: Cents; unit: ValueAddUnit }[]
  rating: PropertyRating
  seed: string
}

/* ---------------------------------------------------------- partner write -- */

/**
 * What a partner may change about a property.
 *
 * `.strict()`, and the omissions are the point (API3): `status`,
 * `verification`, `partnerOrgId`, `slug` and `basePrice` are all absent, so a
 * partner cannot approve their own listing, move it to another org, or set a
 * "from" price that no rate plan backs up.
 */
/**
 * Creating a listing (rule #69).
 *
 * A partner makes their own, inside their own org, and it is born `draft`.
 * `status`, `partnerOrgId` and `basePrice` are absent for the same reason they
 * are absent from the update schema: a partner must not be able to approve
 * their own listing, put it in somebody else's org, or advertise a "from"
 * price that no rate plan backs up.
 *
 * `slug` is absent too — it is derived from the name and made unique by the
 * database, because a partner choosing their own slug is a partner racing for
 * `/hotels/hilton`.
 */
export const propertyCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    city: z.string().trim().min(1).max(120),
    country: z.string().trim().min(1).max(80),
    type: z.enum(PROPERTY_TYPE_VALUES).default("hotel"),
    stars: z.coerce.number().int().min(1).max(5).default(3),
    address: z.string().trim().max(500).default(""),
    description: z.string().max(5000).default(""),
    /** IANA, and it decides when "free until 6pm" actually falls (rule #33). */
    timezone: z.string().trim().max(64).default("UTC"),
    checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("15:00"),
    checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("11:00"),
  })
  .strict()

export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>

export const propertyUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    /*
     * The material fields (rule #71).
     *
     * Editable, and that is the point: if they could never change, the review
     * machinery would be guarding nothing. A live listing changing one of
     * these keeps serving its APPROVED values while the new ones wait.
     */
    city: z.string().trim().min(1).max(120).optional(),
    country: z.string().trim().min(1).max(80).optional(),
    type: z.enum(PROPERTY_TYPE_VALUES).optional(),
    stars: z.coerce.number().int().min(1).max(5).optional(),
    description: z.string().max(5000).optional(),
    address: z.string().max(500).optional(),
    timezone: z.string().max(64).optional(),
    checkInTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    checkOutTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    policyPayment: z.string().max(2000).optional(),
    policyPets: z.string().max(2000).optional(),
    policySmoking: z.string().max(2000).optional(),
    policyChildren: z.string().max(2000).optional(),
    /** Amenity slugs. Replaces the whole set. */
    amenities: z.array(z.string().max(64)).max(60).optional(),
  })
  .strict()

export type PropertyUpdateInput = z.infer<typeof propertyUpdateSchema>

/* ============================================================================
 * Rooms and rate plans — the WRITE side (Module 2).
 *
 * This half was missing entirely: the API could read a catalogue in full detail
 * and nothing could create one. Rate plans in particular carry rules #1, #42
 * and #47 — the cancellation shape, the payment mode and the no-show terms —
 * so until this existed, none of those could be set by the property they
 * belong to.
 * ========================================================================== */

/**
 * The room's fields, WITHOUT defaults.
 *
 * Defaults belong to `create` and nowhere else. A `.default()` survives
 * `.partial()`, so a PATCH that only sends `units` arrives carrying
 * `description: ""` and `features: []` as well — and silently wipes both. The
 * absence of a key has to stay an absence all the way to the UPDATE.
 */
const roomFields = {
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000),
  maxAdults: z.int().min(1).max(20),
  maxChildren: z.int().min(0).max(20),
  maxOccupancy: z.int().min(1).max(30),
  bed: z.string().trim().max(80),
  size: z.int().min(0).max(2000),
  features: z.array(z.string().trim().max(64)).max(40),
  /**
   * How many physical rooms of this type exist.
   *
   * Changing it moves the inventory calendar, which is why it is not just
   * another field — see `RoomUnitsResult`.
   */
  units: z.int().min(0).max(500),
}

export const roomCreateSchema = z
  .object({
    ...roomFields,
    description: roomFields.description.default(""),
    bed: roomFields.bed.default(""),
    size: roomFields.size.default(0),
    features: roomFields.features.default([]),
  })
  .strict()

export type RoomCreateInput = z.infer<typeof roomCreateSchema>

/** Every field optional; `status` is how a room is retired, never deleted. */
export const roomUpdateSchema = z
  .object({ ...roomFields, status: z.enum(["active", "archived"]) })
  .partial()
  .strict()

export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>

/**
 * What changing `units` did to the calendar.
 *
 * A reduction cannot apply to a date that has more rooms already sold than the
 * new count — the overbooking CHECK refuses it, and rightly: a room that is
 * booked cannot be un-sold. Rather than failing the whole change, the dates
 * that could not move are named, so the property can see exactly where their
 * existing bookings are.
 */
export type RoomUnitsResult = {
  /** Future dates updated to the new count. */
  applied: number
  /** Dates left alone because they already hold more bookings than that. */
  blocked: string[]
}

/* ------------------------------------------------------------- rate plans -- */

/**
 * The terms a MANAGER may set: what the room costs and what it includes.
 *
 * Revenue management is a daily job, so it does not need the org's owner.
 */
const ratePlanCommercialFields = {
  name: z.string().trim().min(1).max(120),
  basePrice: centsSchema,
  inclusions: z.array(z.string().trim().max(80)).max(20),
  defaultMinStay: z.int().min(1).max(365),
  defaultMaxStay: z.int().min(1).max(365).nullable(),
  isDefault: z.boolean(),
  status: z.enum(["active", "draft", "archived"]),
}

/**
 * The terms only an ORG ADMIN may set.
 *
 * These are not prices, they are promises: what a guest gets back when plans
 * change, and when their money is taken. Rules #1, #42 and #47 all live here,
 * and every one of them is enforceable against a card. That is a different
 * kind of authority from choosing a nightly rate.
 */
const ratePlanTermsFields = {
  cancelFreeUntil: z.enum(["6pm_arrival", "24h", "48h", "7d", "14d", "non_refundable"]),
  cancelCharge: z.enum(["first_night", "percent", "full"]),
  cancelChargeValue: z.int().min(1).max(100).nullable(),
  /** Rule #47. `null` = a no-show costs whatever a late cancellation costs. */
  noShowCharge: z.enum(["first_night", "percent", "full"]).nullable(),
  noShowChargeValue: z.int().min(1).max(100).nullable(),
  /** Rule #42. `guarantee` is refused on a non-refundable rate. */
  paymentMode: z.enum(["prepay", "guarantee"]),
}

/**
 * A charge and its value have to agree, in the contract as well as the table.
 *
 * The database refuses the mismatch either way; catching it here is what lets
 * a partner see WHICH field is wrong instead of a constraint name.
 */
const pairsAgree = (data: {
  cancelCharge?: string
  cancelChargeValue?: number | null
  noShowCharge?: string | null
  noShowChargeValue?: number | null
  cancelFreeUntil?: string
  paymentMode?: string
}, ctx: z.RefinementCtx) => {
  if (data.cancelCharge !== undefined) {
    const needsValue = data.cancelCharge === "percent"
    if (needsValue !== (data.cancelChargeValue != null)) {
      ctx.addIssue({
        code: "custom",
        path: ["cancelChargeValue"],
        message: needsValue
          ? "A percentage charge needs a value between 1 and 100"
          : "Only a percentage charge takes a value",
      })
    }
  }

  const needsNoShowValue = data.noShowCharge === "percent"
  if (data.noShowCharge != null && needsNoShowValue !== (data.noShowChargeValue != null)) {
    ctx.addIssue({
      code: "custom",
      path: ["noShowChargeValue"],
      message: needsNoShowValue
        ? "A percentage no-show charge needs a value between 1 and 100"
        : "Only a percentage no-show charge takes a value",
    })
  }
  if (data.noShowCharge == null && data.noShowChargeValue != null) {
    ctx.addIssue({
      code: "custom",
      path: ["noShowChargeValue"],
      message: "Set a no-show charge before giving it a value",
    })
  }

  // Rule #42: the rate that gives up the right to cancel must be paid up front.
  if (data.cancelFreeUntil === "non_refundable" && data.paymentMode === "guarantee") {
    ctx.addIssue({
      code: "custom",
      path: ["paymentMode"],
      message: "A non-refundable rate has to be paid up front",
    })
  }
}

const ratePlanShape = z.object({ ...ratePlanCommercialFields, ...ratePlanTermsFields })

/**
 * Defaults live HERE, on create, and nowhere else.
 *
 * A `.default()` survives `.partial()`. Left on the shared shape, a PATCH that
 * only changes the price would arrive carrying `paymentMode: "prepay"`,
 * `inclusions: []` and `status: "active"` — quietly resetting a plan's terms,
 * wiping what it includes, and un-archiving it.
 */
export const ratePlanCreateSchema = ratePlanShape
  .extend({
    inclusions: ratePlanCommercialFields.inclusions.default([]),
    defaultMinStay: ratePlanCommercialFields.defaultMinStay.default(1),
    defaultMaxStay: ratePlanCommercialFields.defaultMaxStay.default(null),
    isDefault: ratePlanCommercialFields.isDefault.default(false),
    status: ratePlanCommercialFields.status.default("active"),
    cancelChargeValue: ratePlanTermsFields.cancelChargeValue.default(null),
    noShowCharge: ratePlanTermsFields.noShowCharge.default(null),
    noShowChargeValue: ratePlanTermsFields.noShowChargeValue.default(null),
    paymentMode: ratePlanTermsFields.paymentMode.default("prepay"),
  })
  .strict()
  .superRefine(pairsAgree)
export type RatePlanCreateInput = z.infer<typeof ratePlanCreateSchema>

/**
 * A partial update, checked by the same rules.
 *
 * `.partial()` before `.superRefine()`, so the pair checks still run on
 * whichever fields were sent — a request that changes `cancelCharge` to
 * `percent` and forgets the number is refused here rather than at the table.
 */
export const ratePlanUpdateSchema = ratePlanShape.partial().strict().superRefine(pairsAgree)
export type RatePlanUpdateInput = z.infer<typeof ratePlanUpdateSchema>

/**
 * Which fields only an org admin may send (rules #1, #42, #47).
 *
 * Derived from the shape rather than hand-listed: a term added to
 * `ratePlanTermsFields` tomorrow is admin-only from the moment it exists,
 * instead of the day somebody remembers to add it here too.
 */
export const RATE_PLAN_TERMS_FIELDS: readonly string[] = Object.keys(ratePlanTermsFields)

/* ============================================================================
 * Value-adds — the extras a guest can put on a booking (Module 2).
 *
 * The quote engine has always been able to price these, and nothing could
 * create one. `per_person_per_night` exists because the prototype charged
 * "Daily breakfast" once for a three-night stay (rule #10).
 * ========================================================================== */

export const VALUE_ADD_UNITS = [
  "per_stay",
  "per_night",
  "per_person",
  "per_person_per_night",
] as const

/** No `.default()` on the shared shape — see `ratePlanCreateSchema`. */
const valueAddFields = {
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(64),
  description: z.string().max(2000),
  /** Cents. Zero is legal: a free extra is still an extra worth listing. */
  price: centsSchema,
  unit: z.enum(VALUE_ADD_UNITS),
  /** `false` retires it. There is no delete — bookings reference these rows. */
  active: z.boolean(),
}

export const valueAddCreateSchema = z
  .object({
    ...valueAddFields,
    category: valueAddFields.category.default("general"),
    description: valueAddFields.description.default(""),
    unit: valueAddFields.unit.default("per_stay"),
    active: valueAddFields.active.default(true),
  })
  .strict()

export type ValueAddCreateInput = z.infer<typeof valueAddCreateSchema>

export const valueAddUpdateSchema = z.object(valueAddFields).partial().strict()
export type ValueAddUpdateInput = z.infer<typeof valueAddUpdateSchema>

/* ============================================================================
 * Photos (rule #73).
 * ========================================================================== */

/**
 * Asking for somewhere to put a file.
 *
 * The size and the type are DECLARED, not uploaded — this is the request that
 * happens before any bytes exist. Both are then signed into the URL, so a
 * client that lied here receives a URL that storage itself refuses. Nothing is
 * being taken on trust; it is being written into the contract with the bucket.
 */
export const photoUploadRequestSchema = z
  .object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    bytes: z.int().positive().max(5 * 1024 * 1024),
  })
  .strict()

export type PhotoUploadRequestInput = z.infer<typeof photoUploadRequestSchema>

/**
 * Confirming that the upload landed.
 *
 * A separate call because the browser writes to storage directly and this API
 * never sees it happen. Until this arrives there is no row — which is exactly
 * right: an upload that failed halfway leaves nothing behind to clean up.
 */
export const photoConfirmSchema = z
  .object({
    /** Handed back by the upload-URL call. Never chosen by the client. */
    key: z.string().min(1).max(512),
    category: z.enum(["exterior", "interior", "rooms", "amenities", "dining"]).default("exterior"),
    caption: z.string().trim().max(200).default(""),
    width: z.int().positive().max(20_000).optional(),
    height: z.int().positive().max(20_000).optional(),
  })
  .strict()

export type PhotoConfirmInput = z.infer<typeof photoConfirmSchema>

export const photoUpdateSchema = z
  .object({
    category: z.enum(["exterior", "interior", "rooms", "amenities", "dining"]),
    caption: z.string().trim().max(200),
    position: z.int().min(0).max(200),
  })
  .partial()
  .strict()

export type PhotoUpdateInput = z.infer<typeof photoUpdateSchema>

export type PhotoView = {
  id: UUID
  category: string
  caption: string
  position: number
  status: "pending" | "approved" | "rejected"
  /** `null` for a seeded placeholder, which renders from `seed` instead. */
  url: string | null
  seed: string
}

/* ============================================================================
 * Review (rules #70–#72).
 * ========================================================================== */

/**
 * The platform's verdict on a listing.
 *
 * `changes_requested` carries a note and `rejected` may; `approved` never
 * needs one. The note is what a partner actually acts on — "rejected" with no
 * reason is a support ticket, every time.
 */
export const listingDecisionSchema = z
  .object({
    decision: z.enum(["approve", "request_changes", "reject"]),
    note: z.string().trim().max(2000).default(""),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision !== "approve" && value.note.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["note"],
        message: "Say what needs changing — a verdict with no reason is unactionable",
      })
    }
  })

export type ListingDecisionInput = z.infer<typeof listingDecisionSchema>

/** The amenity vocabulary, which only the platform may edit (rule #74). */
export const amenityUpsertSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(64)
      // Lower-case, hyphenated, and nothing else — the slug IS the filter key,
      // and "Free WiFi" vs "free-wifi" is how one vocabulary becomes two.
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lower-case words joined by hyphens"),
    label: z.string().trim().min(1).max(80),
    category: z.string().trim().min(1).max(64).default("general"),
    icon: z.string().trim().min(1).max(64).default("check"),
  })
  .strict()

export type AmenityUpsertInput = z.infer<typeof amenityUpsertSchema>

/* ============================================================================
 * Module 14 — the saved list.
 * ========================================================================== */

/**
 * How many properties one person may save (API4).
 *
 * A saved list is something a person scrolls, so a bound is honest rather than
 * restrictive: past a few hundred it has stopped being a shortlist. It also
 * stops an authenticated client from writing an unbounded number of rows by
 * walking the catalogue.
 */
export const FAVORITES_LIMIT = 500

/**
 * A saved card.
 *
 * Same shape as a search result plus two facts only this list can state.
 *
 * `available` exists because a property can be suspended after somebody saved
 * it. Dropping it silently makes the list shrink for no visible reason;
 * showing it as if it were bookable sends the guest to a dead page. So it
 * stays, and it says so.
 */
export type FavoriteItem = PropertyListItem & {
  savedAt: string
  available: boolean
}

/* ============================================================================
 * The platform's property list (admin `properties`, `properties/[id]`).
 * ========================================================================== */

/**
 * The lifecycle, as a zod enum.
 *
 * Spelled out beside the type rather than derived from it: a `PropertyStatus`
 * is a compile-time thing and a query parameter arrives at runtime, so the
 * validator needs values it can actually check. The satisfies clause is what
 * keeps the two from drifting — adding a status to the type without adding it
 * here stops compiling.
 */
export const PROPERTY_STATUS_VALUES = [
  "draft",
  "pending_review",
  "changes_requested",
  "active",
  "rejected",
  "suspended",
] as const satisfies readonly PropertyStatus[]

export const adminPropertySearchSchema = z
  .object({
    /** Name, city or slug — one box, like the screen has. */
    q: z.string().trim().max(160).optional(),
    status: z.enum(PROPERTY_STATUS_VALUES).optional(),
    orgId: uuidSchema.optional(),
    /** Only listings waiting on the platform (rule #72). */
    needsReview: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    /** Keyset cursor: the `createdAt` of the last row seen. */
    before: z.string().max(64).optional(),
  })
  .strict()

export type AdminPropertySearchInput = z.infer<typeof adminPropertySearchSchema>

/**
 * A row on the platform's property list.
 *
 * Carries the owner, which the partner's own view never needs and the platform
 * always does: almost every question the platform asks about a listing is
 * really a question about who runs it.
 */
export type AdminPropertyRow = {
  id: UUID
  slug: string
  name: string
  city: string
  country: string
  type: PropertyType
  stars: number | null
  status: PropertyStatus
  orgId: UUID | null
  orgName: string | null
  fromPrice: Cents
  rooms: number
  photos: number
  /** True while an edit is waiting on the platform (rule #71). */
  hasPendingChanges: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Taking a listing off the market, or putting it back (rules #78, #79).
 *
 * A reason is required and has a floor, for the same reason a refund needs
 * one: somebody will read this months later and has to be able to understand
 * the decision. There is no delete — a suspended property keeps its bookings,
 * its reviews and its history.
 */
export const propertySuspensionSchema = z
  .object({
    action: z.enum(["suspend", "reinstate"]),
    reason: z.string().trim().min(10).max(2000),
  })
  .strict()

export type PropertySuspensionInput = z.infer<typeof propertySuspensionSchema>


/* ============================================================================
 * Per-guest pricing (rule #101).
 * ========================================================================== */

/**
 * The whole matrix for a rate plan, replaced in one call.
 *
 * A PUT of the complete grid rather than a PATCH per cell: the numbers only
 * mean anything relative to each other, and a half-applied grid where three
 * guests cost less than two is a price the partner never intended to publish.
 *
 * An empty array clears it — which restores the default, where the party size
 * does not move the price at all.
 */
export const occupancyPricesSchema = z
  .object({
    baseOccupancy: z.coerce.number().int().min(1).max(30).optional(),
    prices: z
      .array(
        z
          .object({
            guests: z.coerce.number().int().min(1).max(30),
            price: centsSchema,
          })
          .strict()
      )
      .max(30),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<number>()
    for (const row of value.prices) {
      if (seen.has(row.guests)) {
        ctx.addIssue({
          code: "custom",
          path: ["prices"],
          message: `Two prices given for ${row.guests} guests`,
        })
        return
      }
      seen.add(row.guests)
    }
  })

export type OccupancyPricesInput = z.infer<typeof occupancyPricesSchema>

export type OccupancyGridView = {
  ratePlanId: UUID
  ratePlanName: string
  basePrice: Cents
  baseOccupancy: number
  maxAdults: number
  /** Every level up to the room's capacity — `isSet` says which are the partner's. */
  rows: { guests: number; price: Cents; isSet: boolean }[]
}
