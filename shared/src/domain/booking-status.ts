import type { ISODate } from "../types/common"
import type {
  Booking,
  BookingActor,
  BookingGuest,
  BookingStatus,
} from "../types/booking"

/* ============================================================================
 * The booking state machine (rule #6).
 *
 * The prototype had none: `setBookingStatus(id, status)` overwrote the field
 * with zero guards. A cancelled booking could be set back to confirmed, a stay
 * could be checked out before it was checked in, and nothing recorded who did
 * it or why.
 * ========================================================================== */

/** Every transition the product allows. Anything absent is rejected. */
export const TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["checked_in", "no_show", "cancelled"],
  checked_in: ["completed"],
  completed: [],
  cancelled: [],
  no_show: [],
}

/** Who may perform each transition. */
const PERMITTED: Readonly<Record<BookingStatus, readonly BookingActor[]>> = {
  // A hold clearing payment, or a property accepting a request.
  confirmed: ["partner_admin", "partner_manager", "platform_admin", "system"],
  // Front desk work — the one thing `staff` may do (rule #14).
  checked_in: ["partner_admin", "partner_manager", "partner_staff", "platform_admin"],
  completed: [
    "partner_admin",
    "partner_manager",
    "partner_staff",
    "platform_admin",
    // The nightly sweep closes stays the desk forgot to check out.
    "system",
  ],
  // Guests cancel their own; staff may not (they can check in, not cancel).
  cancelled: ["guest", "partner_admin", "partner_manager", "platform_admin", "system"],
  // A judgement call about a guest who never arrived — not a staff decision.
  no_show: ["partner_admin", "partner_manager", "platform_admin"],
  pending: [],
}

export type TransitionCheck =
  | { ok: true }
  | { ok: false; reason: "terminal" | "not_allowed" | "forbidden"; message: string }

export function isTerminal(status: BookingStatus): boolean {
  return TRANSITIONS[status].length === 0
}

/**
 * Whether a booking in this state is holding a room.
 *
 * `pending` holds — otherwise the room could be sold while the guest is still
 * on the payment screen. That is also why a pending booking must carry a
 * `holdExpiresAt`: without one, an abandoned checkout keeps the room forever.
 *
 * `no_show` keeps holding until its nights have passed: the guest never came,
 * but the property could not resell those nights either, and the charge is
 * theirs to keep.
 */
export function holdsInventory(status: BookingStatus): boolean {
  return status === "pending" || status === "confirmed" || status === "checked_in" || status === "no_show"
}

/**
 * The single gate every status change goes through.
 *
 * Checks the transition first, then the actor — so an impossible move reports
 * as impossible rather than as a permission problem, which is the more useful
 * error for whoever is debugging it.
 */
export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  actor: BookingActor
): TransitionCheck {
  if (from === to) {
    return { ok: false, reason: "not_allowed", message: `Booking is already ${label(from)}.` }
  }

  if (isTerminal(from)) {
    return {
      ok: false,
      reason: "terminal",
      message: `A ${label(from)} booking cannot change state.`,
    }
  }

  if (!TRANSITIONS[from].includes(to)) {
    return {
      ok: false,
      reason: "not_allowed",
      message: `A booking cannot go from ${label(from)} to ${label(to)}.`,
    }
  }

  if (!PERMITTED[to].includes(actor)) {
    return {
      ok: false,
      reason: "forbidden",
      message: `You are not allowed to mark a booking ${label(to)}.`,
    }
  }

  return { ok: true }
}

function label(status: BookingStatus): string {
  return status.replace(/_/g, " ")
}

/* --------------------------------------------------------------- helpers -- */

export function guestName(guest: Pick<BookingGuest, "firstName" | "lastName">): string {
  return `${guest.firstName} ${guest.lastName}`.trim()
}

/** A stay that has not happened yet and has not been called off. */
export function isUpcoming(
  booking: Pick<Booking, "status" | "checkIn">,
  today: ISODate
): boolean {
  return (
    (booking.status === "pending" || booking.status === "confirmed") && booking.checkIn >= today
  )
}

/** A stay in progress: the guest is in the building. */
export function isInHouse(booking: Pick<Booking, "status">): boolean {
  return booking.status === "checked_in"
}

/**
 * Whether a `pending` hold has lapsed and its inventory should be released.
 *
 * `now` is passed in — the domain never reads the clock.
 */
export function isHoldExpired(
  booking: Pick<Booking, "status" | "holdExpiresAt">,
  now: Date
): boolean {
  if (booking.status !== "pending" || booking.holdExpiresAt === null) return false
  return new Date(booking.holdExpiresAt).getTime() <= now.getTime()
}
