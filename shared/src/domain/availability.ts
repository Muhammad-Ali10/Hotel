import type { ISODate, Occupancy } from "../types/common"
import type {
  RatePlan,
  RatePlanRate,
  ResolvedNight,
  Room,
  RoomInventoryEntry,
} from "../types/property"
import { BOOKING_HORIZON_MONTHS, fitsRoom } from "../types/property"
import { datesInRange, nightsBetween } from "./dates"

/* ============================================================================
 * Availability — the ADVISORY layer.
 *
 * ⚠️  NOTHING IN THIS FILE PREVENTS OVERBOOKING, AND IT CANNOT.
 *
 * Every function here is pure: it answers "is this stay bookable according to
 * the snapshot I was handed". By the time the answer reaches the caller the
 * snapshot is already stale — two guests can both be told "1 room left" and
 * both be right.
 *
 * The authoritative guard lives in the booking transaction (Module 5):
 * `SELECT … FOR UPDATE` over the stay's inventory rows, ordered by date, plus
 * `CHECK (booked_units <= sellable_units)`. That is what actually holds.
 *
 * Use this to disable a button, badge a listing sold-out, and reject early —
 * never as the last word. See docs/ARCHITECTURE.md §3, §4.
 * ========================================================================== */

/* -------------------------------------------------------------- resolve -- */

export type NightSources = {
  room: Pick<Room, "units">
  ratePlan: Pick<RatePlan, "basePrice" | "defaultMinStay" | "defaultMaxStay">
  /** Sparse — absent on most dates. */
  inventory?: RoomInventoryEntry
  /** Sparse — absent on most dates. */
  rate?: RatePlanRate
}

/**
 * Merges the two sparse calendars with their defaults.
 *
 * Inventory comes from the ROOM (shared by every rate plan on it) and price
 * comes from the PLAN. Keeping them apart is what lets "Flexible" and
 * "Non-refundable" be different products sold out of the same 28 rooms —
 * a single table would either duplicate the stock or fuse the prices.
 *
 * This is the `COALESCE` of the availability query, written once so the SQL
 * and the in-memory path cannot disagree.
 */
export function resolveNight(date: ISODate, sources: NightSources): ResolvedNight {
  const { room, ratePlan, inventory, rate } = sources
  return {
    date,
    rate: rate?.rate ?? ratePlan.basePrice,
    minStay: rate?.minStay ?? ratePlan.defaultMinStay,
    minStayThrough: rate?.minStayThrough ?? null,
    maxStay: rate?.maxStay ?? ratePlan.defaultMaxStay ?? null,
    closedToArrival: rate?.closedToArrival ?? false,
    closedToDeparture: rate?.closedToDeparture ?? false,
    minAdvanceHours: rate?.minAdvanceHours ?? null,
    isClosed: inventory?.isClosed ?? false,
    totalUnits: inventory?.totalUnits ?? room.units,
    sellableUnits: inventory?.sellableUnits ?? room.units,
    bookedUnits: inventory?.bookedUnits ?? 0,
  }
}

/** Resolves every night of a stay. Returns `[]` for an invalid range. */
export function resolveStay(
  checkIn: ISODate,
  checkOut: ISODate,
  sources: {
    room: Pick<Room, "units">
    ratePlan: Pick<RatePlan, "basePrice" | "defaultMinStay" | "defaultMaxStay">
    inventory?: ReadonlyMap<ISODate, RoomInventoryEntry>
    rates?: ReadonlyMap<ISODate, RatePlanRate>
  }
): ResolvedNight[] {
  return datesInRange(checkIn, checkOut).map((date) =>
    resolveNight(date, {
      room: sources.room,
      ratePlan: sources.ratePlan,
      ...(sources.inventory?.get(date) ? { inventory: sources.inventory.get(date)! } : {}),
      ...(sources.rates?.get(date) ? { rate: sources.rates.get(date)! } : {}),
    })
  )
}

/* ---------------------------------------------------------------- checks -- */

export type UnavailableReason =
  | "invalid_dates"
  | "closed"
  | "min_stay"
  | "min_stay_through"
  | "max_stay"
  | "closed_to_arrival"
  | "closed_to_departure"
  | "too_late"
  | "beyond_horizon"
  | "capacity"
  | "sold_out"

export type StayCheck =
  | { ok: true }
  | { ok: false; reason: UnavailableReason; message: string }

const OK: StayCheck = { ok: true }

/**
 * Calendar rules only — open/closed, stay-length limits and arrival windows.
 * Says nothing about how many units are left.
 *
 * `departureNight` is the night AFTER the stay: closed-to-departure applies to
 * the checkout date, which is not one of the nights the guest occupies. Pass
 * it when the caller has it; `undefined` simply skips that check.
 */
export function checkStay(
  nights: readonly ResolvedNight[],
  context?: {
    /** The calendar row for the checkout date, for the CTD rule. */
    departureNight?: Pick<ResolvedNight, "closedToDeparture">
    /** Absolute "now", for the advance-booking rule. Never read from a clock. */
    now?: Date
    /** The exact instant the stay begins, in the property's own zone. */
    checkInInstant?: Date
  }
): StayCheck {
  if (nights.length === 0) {
    return {
      ok: false,
      reason: "invalid_dates",
      message: "Check-out must be after check-in.",
    }
  }

  const arrival = nights[0]!

  // Closed to Arrival — the room may be occupied on this date, but a stay may
  // not BEGIN here. Typically a Sunday CTA protecting a Friday–Sunday block.
  if (arrival.closedToArrival) {
    return {
      ok: false,
      reason: "closed_to_arrival",
      message: "Check-in is not available on that date. Try arriving a day earlier or later.",
    }
  }

  if (context?.departureNight?.closedToDeparture) {
    return {
      ok: false,
      reason: "closed_to_departure",
      message: "Check-out is not available on that date. Try a different departure day.",
    }
  }

  // MinLOS — applies because the stay STARTS here (rule #26).
  if (nights.length < arrival.minStay) {
    return {
      ok: false,
      reason: "min_stay",
      message: `These dates have a ${arrival.minStay}-night minimum stay.`,
    }
  }

  if (arrival.maxStay !== null && nights.length > arrival.maxStay) {
    return {
      ok: false,
      reason: "max_stay",
      message: `These dates allow a maximum stay of ${arrival.maxStay} nights.`,
    }
  }

  // MinStayThrough — applies to every night the stay covers, arrival or not.
  // Without it a Friday three-night minimum is bypassed by arriving Thursday.
  for (const night of nights) {
    if (night.minStayThrough !== null && nights.length < night.minStayThrough) {
      return {
        ok: false,
        reason: "min_stay_through",
        message: `Your dates include nights with a ${night.minStayThrough}-night minimum stay.`,
      }
    }
  }

  if (nights.some((n) => n.isClosed)) {
    return {
      ok: false,
      reason: "closed",
      message: "Some of your dates are unavailable at this property.",
    }
  }

  // Advance booking — a reservation landing ten minutes before arrival is a
  // housekeeping problem, not a theoretical one.
  if (arrival.minAdvanceHours !== null && context?.now && context.checkInInstant) {
    const hoursAhead =
      (context.checkInInstant.getTime() - context.now.getTime()) / 3_600_000
    if (hoursAhead < arrival.minAdvanceHours) {
      return {
        ok: false,
        reason: "too_late",
        message: `This rate must be booked at least ${arrival.minAdvanceHours} hours before check-in.`,
      }
    }
  }

  return OK
}

/**
 * Units still sellable across the WHOLE stay — the tightest night wins.
 *
 * One full night blocks the entire reservation: a guest cannot occupy a room
 * for two nights out of three. Checking only the first or the average night
 * would sell a stay that cannot physically be honoured.
 *
 * Counts against `sellableUnits`, not `totalUnits` (rule #25).
 */
export function unitsLeft(nights: readonly ResolvedNight[]): number {
  if (nights.length === 0) return 0
  let fewest = Number.POSITIVE_INFINITY
  for (const n of nights) {
    const left = n.sellableUnits - n.bookedUnits
    if (left < fewest) fewest = left
  }
  return Math.max(0, fewest)
}

/** The night that is blocking a stay, for a "sold out on 13 Aug" message. */
export function tightestNight(nights: readonly ResolvedNight[]): ResolvedNight | null {
  let tightest: ResolvedNight | null = null
  let fewest = Number.POSITIVE_INFINITY
  for (const n of nights) {
    const left = n.sellableUnits - n.bookedUnits
    if (left < fewest) {
      fewest = left
      tightest = n
    }
  }
  return tightest
}

export type RoomCapacity = Pick<Room, "name" | "maxAdults" | "maxChildren" | "maxOccupancy">

/**
 * Whether a stay falls inside the booking horizon (rule #34).
 *
 * Checked separately from the calendar because it bounds the QUERY as well as
 * the answer: an unbounded date range is a cheap way to make the database walk
 * an arbitrary number of rows (API4). Callers reject before touching the
 * calendar at all.
 */
export function withinBookingHorizon(
  checkOut: ISODate,
  today: ISODate,
  months = BOOKING_HORIZON_MONTHS
): boolean {
  return checkOut <= addMonths(today, months)
}

/** Calendar-month arithmetic, clamped — 31 Jan + 1 month is 28/29 Feb. */
function addMonths(iso: ISODate, months: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number]
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10) as ISODate
}

/**
 * THE booking gate — calendar rules, party size, and inventory.
 *
 * Advisory (see the file header). The booking transaction runs the same checks
 * again under a row lock, and only that result is binding.
 */
export function checkAvailability(input: {
  nights: readonly ResolvedNight[]
  occupancy: Occupancy
  room: RoomCapacity
  /** Calendar row for the checkout date, for the closed-to-departure rule. */
  departureNight?: Pick<ResolvedNight, "closedToDeparture">
  /** Absolute now, and the instant the stay begins in the property's zone. */
  now?: Date
  checkInInstant?: Date
}): StayCheck {
  const stay = checkStay(input.nights, {
    ...(input.departureNight ? { departureNight: input.departureNight } : {}),
    ...(input.now ? { now: input.now } : {}),
    ...(input.checkInInstant ? { checkInInstant: input.checkInInstant } : {}),
  })
  if (!stay.ok) return stay

  if (!fitsRoom(input.room, input.occupancy)) {
    return {
      ok: false,
      reason: "capacity",
      message: capacityMessage(input.room, input.occupancy),
    }
  }

  if (unitsLeft(input.nights) <= 0) {
    return {
      ok: false,
      reason: "sold_out",
      message: `The ${input.room.name} is fully booked for these dates.`,
    }
  }

  return OK
}

/**
 * Says which limit was breached, not just "too many people" — an adult limit
 * and a total-occupancy limit send a guest to different rooms.
 */
function capacityMessage(room: RoomCapacity, occupancy: Occupancy): string {
  if (occupancy.adults > room.maxAdults) {
    return `The ${room.name} sleeps ${room.maxAdults} ${
      room.maxAdults === 1 ? "adult" : "adults"
    }. Choose a larger room or reduce the party size.`
  }
  if (occupancy.children > room.maxChildren) {
    return room.maxChildren === 0
      ? `The ${room.name} cannot accommodate children.`
      : `The ${room.name} takes at most ${room.maxChildren} children.`
  }
  return `The ${room.name} sleeps ${room.maxOccupancy} guests in total. Choose a larger room or reduce the party size.`
}

export type RoomCandidate = {
  room: RoomCapacity
  nights: readonly ResolvedNight[]
}

/**
 * Property-level answer for a search result: is ANY room type bookable.
 *
 * The listing used to consult only the property calendar, so a fully booked
 * property still rendered as bookable right up until the guest reached the
 * reserve card.
 */
export function checkPropertyAvailability(
  candidates: readonly RoomCandidate[],
  occupancy: Occupancy
): StayCheck {
  if (candidates.length === 0) {
    return { ok: false, reason: "sold_out", message: "No rooms available for these dates." }
  }

  let firstFailure: StayCheck | null = null
  for (const candidate of candidates) {
    const result = checkAvailability({
      nights: candidate.nights,
      occupancy,
      room: candidate.room,
    })
    if (result.ok) return OK
    firstFailure ??= result
  }

  return (
    firstFailure ?? {
      ok: false,
      reason: "sold_out",
      message: "Sold out for your dates.",
    }
  )
}

/**
 * Rooms a guest can be offered instead, when their choice is unavailable.
 *
 * Backs rule #24: a guest who loses the last room at the moment of confirming
 * is shown the alternatives for the same property and dates rather than being
 * dropped back to search with their form emptied.
 */
export function alternativeRooms<T extends RoomCandidate>(
  candidates: readonly T[],
  input: { occupancy: Occupancy; exclude?: ReadonlySet<string> },
  keyOf: (candidate: T) => string
): T[] {
  return candidates.filter((candidate) => {
    if (input.exclude?.has(keyOf(candidate))) return false
    return checkAvailability({
      nights: candidate.nights,
      occupancy: input.occupancy,
      room: candidate.room,
    }).ok
  })
}

/** Convenience for callers that only have raw dates. */
export function stayNights(checkIn: ISODate, checkOut: ISODate): number {
  return nightsBetween(checkIn, checkOut)
}
