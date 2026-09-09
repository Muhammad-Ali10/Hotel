import type {
  Cents,
  ISODate,
  ImageSeed,
  Occupancy,
  TimeOfDay,
  TimeZone,
  Timestamps,
  UUID,
} from "./common"

/* -------------------------------------------------------------- property -- */

/**
 * `Property`, not `Hotel` — the catalogue holds resorts too, and a `Hotel`
 * whose `type` is `"resort"` reads as a mistake. Admin and extranet already
 * called it a property; only the core types disagreed.
 */
/**
 * What kind of place this is.
 *
 * Eight, not two. The registration wizard has offered all eight since it was
 * designed; the database accepted `hotel` and `resort`, so a partner choosing
 * "Villa" would have got a CHECK constraint violation at the end of a
 * thirty-one step form. The fourth vocabulary divergence in this codebase, and
 * fixed the same way as the others: one list, and it is this one.
 */
export type PropertyType =
  | "hotel"
  | "resort"
  | "guesthouse"
  | "hostel"
  | "apartment"
  | "villa"
  | "bnb"
  | "motel"

/**
 * Lifecycle. Taken from the admin panel, which was the only surface that had
 * one — and it is exactly what the 29-step join wizard needs to land in:
 * `draft` → `pending_review` → `active`.
 */
export type PropertyStatus =
  | "draft"
  | "pending_review"
  | "changes_requested"
  | "active"
  | "rejected"
  | "suspended"

export type VerificationStatus = "not_submitted" | "submitted" | "reviewed"

/** House rules. Cancellation is NOT here — it belongs to a rate plan. */
export type PropertyPolicies = {
  checkInTime: TimeOfDay
  checkOutTime: TimeOfDay
  payment: string
  pets: string
  smoking: string
  children: string
}

export type Property = Timestamps & {
  id: UUID
  /** URL slug — `the-ritz-carlton`. Stable, unique, guest-facing. */
  slug: string

  name: string
  city: string
  country: string
  address: string

  /**
   * Needed because cancellation deadlines are evaluated in the property's own
   * wall clock, not the guest's. Nothing in the prototype had this.
   */
  timezone: TimeZone

  type: PropertyType

  /**
   * Official classification, 1–5 (rule #15). This is NOT the guest review
   * score — that is always derived from published reviews and never stored.
   */
  stars: number | null

  description: string
  amenities: string[]

  /**
   * Cheapest active rate plan across all rooms, in cents. DERIVED and stored
   * only so listings can sort and filter on price without joining every plan.
   * Recomputed whenever a rate plan changes; never hand-written.
   */
  basePrice: Cents

  partnerOrgId: UUID | null

  status: PropertyStatus
  verification: VerificationStatus

  policies: PropertyPolicies

  /**
   * Latest local time a same-day booking is accepted, `HH:mm`. `null` → no
   * cutoff. Evaluated in the property's own `timezone`.
   */
  sameDayCutoff: TimeOfDay | null

  seed: ImageSeed
}

/**
 * How far ahead a stay may be booked (rule #34).
 *
 * Also bounds every availability and calendar query: an unbounded date range
 * is a free way to make the database do arbitrary work (API4).
 */
export const BOOKING_HORIZON_MONTHS = 18

/* ------------------------------------------------------------------ room -- */

/**
 * A room TYPE, not a physical room. `units` is how many of it the property has.
 *
 * Carries no price: a room is sold through one or more rate plans, and the
 * price belongs to the plan (rule #27).
 */
export type Room = Timestamps & {
  id: UUID
  propertyId: UUID
  name: string
  description: string

  /**
   * Capacity, split by rule #28. `maxOccupancy` is the hard ceiling and can be
   * lower than `maxAdults + maxChildren` — a room that sleeps 2 adults or
   * 1 adult + 2 children still only sleeps three people in total.
   */
  maxAdults: number
  maxChildren: number
  maxOccupancy: number

  bed: string
  /** square metres */
  size: number
  features: string[]

  /** How many of this room type the property has. */
  units: number

  seed: ImageSeed
}

/** True when a party fits a room on every axis. */
export function fitsRoom(
  room: Pick<Room, "maxAdults" | "maxChildren" | "maxOccupancy">,
  occupancy: Occupancy
): boolean {
  return (
    occupancy.adults <= room.maxAdults &&
    occupancy.children <= room.maxChildren &&
    occupancy.adults + occupancy.children <= room.maxOccupancy
  )
}

/* ------------------------------------------------------------ rate plans -- */

/** How long before check-in a guest may cancel free of charge. */
export type CancelFreeUntil =
  | "6pm_arrival"
  | "24h"
  | "48h"
  | "7d"
  | "14d"
  | "non_refundable"

/** What the property keeps when the guest cancels after the deadline. */
export type CancelCharge = "first_night" | "percent" | "full"

/**
 * Structured — never prose (rule #1).
 *
 * The prototype had this in three incompatible shapes: the join wizard
 * collected `cancelFreeUntil` + `cancelCharge` and threw them away, the
 * property carried an editable free-text sentence shown to the guest, and
 * `refundFor()` enforced a hardcoded 48h/50% nobody could change. Edit the
 * sentence and the refund did not move — display and enforcement disagreed
 * silently.
 *
 * The sentence the guest reads is now GENERATED from these fields, so the two
 * cannot drift apart.
 */
export type CancellationPolicy = {
  freeUntil: CancelFreeUntil
  charge: CancelCharge
  /** 1–100, required when and only when `charge` is `"percent"`. */
  chargeValue: number | null

  /**
   * What a guest who simply never arrives is charged (rule #47).
   *
   * Absent or `null` means "whatever a cancellation at arrival would have
   * cost" — the behaviour before this existed, and the one nothing has to opt
   * out of. Optional rather than required because that is what it is: a rate
   * plan that says nothing about no-shows is the normal case, not an oversight.
   *
   * It is separate from `charge` because the two are genuinely different
   * events, and every hotel prices them differently. A guest who cancels at
   * 47 hours leaves the property a night to re-sell the room; a guest who says
   * nothing leaves it staffing a desk for someone who never comes. "Free
   * cancellation until 48 hours, but no-show is charged in full" is an
   * ordinary policy — and without these two fields there is no way to write it
   * down except by removing free cancellation, which is not what the property
   * asked for.
   */
  noShowCharge?: CancelCharge | null
  /** 1–100, required when and only when `noShowCharge` is `"percent"`. */
  noShowChargeValue?: number | null
}

export type RatePlanStatus = "active" | "draft"

/**
 * How a room is sold (rule #27).
 *
 * The same room becomes several products: "Flexible" at $725 with free
 * cancellation, "Non-refundable" at $620 with none, "Breakfast included" at
 * $780. This is the ordinary revenue lever of every hotel, and the prototype
 * could not express it — cancellation sat on the property, so one room had one
 * policy and one price.
 *
 * Both surfaces already reached for this: the extranet had a `RatePlan` type
 * and the join wizard has a rate-plan step at 19.
 *
 * v1 seeds exactly one `isDefault` plan per room, so nothing changes for a
 * guest until the partner creates a second one.
 */
export type RatePlan = Timestamps & {
  id: UUID
  roomId: UUID
  name: string

  /** Nightly rate before any calendar override. */
  basePrice: Cents

  cancellation: CancellationPolicy

  /** What the rate includes beyond the room — "Breakfast for two". Display. */
  inclusions: string[]

  /** Applies to any date with no calendar override of its own. */
  defaultMinStay: number
  /** Default longest stay. `null` → unlimited. */
  defaultMaxStay: number | null

  status: RatePlanStatus
  /** The plan a room falls back to. Exactly one per room. */
  isDefault: boolean
}

/* ----------------------------------------------------------------- photo -- */

export type PhotoCategory = "exterior" | "interior" | "rooms" | "amenities" | "dining"

export type Photo = {
  id: UUID
  propertyId: UUID
  category: PhotoCategory
  caption: string
  /** Sort order within the gallery. */
  position: number
  seed: ImageSeed
}

/* ------------------------------------------------------------- value-add -- */

/**
 * `per_person_per_night` is new (rule #10).
 *
 * The prototype had only three units, so "Daily breakfast" was priced
 * `per_person` — charging $32 once for a 3-night, 2-guest stay. That is $64 for
 * six breakfasts.
 */
export type ValueAddUnit = "per_stay" | "per_night" | "per_person" | "per_person_per_night"

export type ValueAdd = Timestamps & {
  id: UUID
  propertyId: UUID
  name: string
  category: string
  description: string
  price: Cents
  unit: ValueAddUnit
  active: boolean
}

/* ------------------------------------------------------------- inventory -- */

/**
 * Physical stock for one room type on one date.
 *
 * Inventory belongs to the ROOM, not to a rate plan: "Flexible" and
 * "Non-refundable" sell out of the same 28 Deluxe Kings. Selling them from
 * separate counters would let a property sell 56.
 *
 * SPARSE — a row exists only when the date has an override or a booking.
 * Materialising every room × every date would be ~58M mostly-empty rows at
 * 10,000 properties. See docs/ARCHITECTURE.md §3.
 */
export type RoomInventoryEntry = {
  roomId: UUID
  date: ISODate

  /** `null` → open. Closing a room closes it on every rate plan. */
  isClosed: boolean | null

  /**
   * Physical rooms of this type, copied from `Room.units` when the row is
   * created. Used for occupancy reporting, not for the overbooking guard.
   */
  totalUnits: number

  /**
   * How many may actually be sold. Today ALWAYS equal to `totalUnits`
   * (rule #25) — deliberate overbooking is not enabled.
   *
   * A separate column so that enabling an allowance later is a DATA change,
   * not a migration on a `CHECK` over a live table. The constraint is
   * `bookedUnits <= sellableUnits`.
   */
  sellableUnits: number

  bookedUnits: number
}

/**
 * Price and stay restrictions for one rate plan on one date.
 *
 * Separate from inventory because two plans on the same room share stock but
 * not price: the same night can be $725 flexible and $620 non-refundable.
 *
 * Also sparse — `null` means "use the plan's default".
 */
export type RatePlanRate = {
  ratePlanId: UUID
  date: ISODate

  /** `null` → use `RatePlan.basePrice`. */
  rate: Cents | null

  /**
   * Minimum nights when the stay STARTS on this date — MinLOS (rule #26).
   * `null` → use `RatePlan.defaultMinStay`.
   */
  minStay: number | null

  /**
   * Minimum nights for any stay that COVERS this date, arrival or not
   * (rule #26). `null` → no through-restriction.
   *
   * Arrival-only rules are trivially bypassed: a Friday–Saturday three-night
   * minimum does nothing if the guest checks in on Thursday, where the minimum
   * is one. This is the column that closes that hole.
   */
  minStayThrough: number | null

  /**
   * Longest stay that may START on this date. `null` → no maximum.
   *
   * Revenue management: a 30-night stay over a peak week blocks inventory that
   * would sell at a far better rate in three-night pieces.
   */
  maxStay: number | null

  /**
   * Closed to Arrival — the room may be occupied on this date, but a stay may
   * not BEGIN here. `null` → open.
   *
   * The classic use is a Sunday CTA that stops one-night weekend-tail bookings
   * from breaking up a Friday–Sunday block.
   */
  closedToArrival: boolean | null

  /** Closed to Departure — a stay may not END on this date. `null` → open. */
  closedToDeparture: boolean | null

  /**
   * How many hours before check-in a booking must be made. `null` → none.
   *
   * Without it a booking can land ten minutes before arrival, which is a real
   * problem for housekeeping rather than a theoretical one.
   */
  minAdvanceHours: number | null
}

/**
 * One night of a stay, after the two sparse tables have been merged with the
 * room's and the plan's defaults.
 */
export type ResolvedNight = {
  date: ISODate

  /** From the rate plan. */
  rate: Cents
  minStay: number
  minStayThrough: number | null
  maxStay: number | null
  closedToArrival: boolean
  closedToDeparture: boolean
  minAdvanceHours: number | null

  /** From the room's inventory. */
  isClosed: boolean
  totalUnits: number
  sellableUnits: number
  bookedUnits: number
}
