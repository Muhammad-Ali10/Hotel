import type { Cents, ISODate, ISODateTime, ImageSeed, Occupancy, Timestamps, UUID } from "./common"
import type { PaymentMode, PaymentStatus } from "./payment"
import type { PartnerRole } from "./user"
import type { CancellationPolicy, ValueAddUnit } from "./property"

/* ---------------------------------------------------------------- status -- */

/**
 * Six states (rule #6).
 *
 * `checked_out` is gone — it and `completed` behaved identically (a review
 * opened on either) and nothing in the product ever set `completed`, so they
 * were one state wearing two names.
 *
 * `no_show` is new. Without it a property's only option for a guest who never
 * arrived was Cancel, which ran the refund calculation and handed back 50% of
 * the stay. The admin panel already modelled `No-show`; the core types did not.
 */
export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "no_show"
  | "cancelled"

export type BookingSource = "direct" | "booking_com" | "expedia" | "travel_agency"

/**
 * Payment lives in `./payment` now (Module 7).
 *
 * The prototype's `"card" | "property"` is gone: `property` meant no card at
 * all, which left every cancellation charge and no-show fee with nothing to
 * charge. See `PaymentMode`.
 */

/**
 * Commission is only earned by a stay that actually happened (rule #9).
 *
 *  - `pending` → booking is live, outcome unknown
 *  - `earned`  → stay completed, goes into the payout cycle
 *  - `void`    → cancelled or no-show; the amount is KEPT for reporting
 *                ("commission lost to cancellations") but never charged
 */
export type CommissionStatus = "pending" | "earned" | "void"

export type RefundStatus = "full" | "partial" | "none" | "pending" | "processed"

/* --------------------------------------------------------------- pricing -- */

export type PriceLine = {
  id: string
  label: string
  /** Negative for discounts. */
  amount: Cents
}

/**
 * Every money figure a booking shows, anywhere, comes from this block — and it
 * is frozen at booking time so later rate or policy edits cannot rewrite
 * history.
 *
 * No `taxes`, no `taxTotal`, no `subtotal` (rule #11): the platform charges no
 * tax, which makes the old `subtotal` identical to `total` — two names for one
 * number.
 */
export type BookingPricing = {
  nights: number

  /**
   * What each night actually cost, in stay order. `roomSubtotal` is their sum.
   *
   * Kept rather than just an average because rates differ per date and several
   * rules need a specific night: a `first_night` cancellation charge must bill
   * the real first night, and an early departure has to know which nights went
   * unused. An average cannot answer either.
   */
  nightlyRates: Cents[]

  /**
   * Average across the stay — DISPLAY ONLY. Multiplying it back out does not
   * reproduce `roomSubtotal` when rates differ.
   */
  ratePerNight: Cents

  roomSubtotal: Cents
  addOnsTotal: Cents
  discount?: PriceLine
  total: Cents
}

/* --------------------------------------------------------------- booking -- */

export type BookingGuest = {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
}

export type BookingAddOn = {
  id: UUID
  valueAddId: UUID
  /** Snapshot — the value-add may be renamed or retired later. */
  name: string
  unit: ValueAddUnit
  unitPrice: Cents
  /**
   * How many of this package (rule #23). Applied AFTER the unit resolves:
   * spa at $120 `per_person`, 2 guests, qty 2 → $480 (two treatments each).
   */
  qty: number
  /** `resolvedUnitPrice × qty` for this stay's nights and party size. */
  amount: Cents
}

export type Cancellation = {
  at: ISODateTime
  reason: string
  by: "guest" | "property" | "admin"
  refund: Cents
  refundStatus: RefundStatus
}

export type Booking = Timestamps & {
  /** Internal primary key. Never shown to a guest. */
  id: UUID

  /**
   * Guest-facing reference, `STY-XXXXXX`. Deliberately a separate column from
   * the primary key — in the prototype the ref WAS the id, so changing the
   * reference scheme would have meant changing every foreign key.
   *
   * Alphabet omits `I O 0 1` so a reference read aloud is unambiguous.
   */
  ref: string

  /**
   * The account this booking belongs to.
   *
   * ALWAYS set for a booking made on the public site — an account is required
   * to check out (rule #29). `null` only for reservations that genuinely have
   * no platform account behind them: a walk-in the property enters itself, a
   * phone booking, or an OTA import.
   *
   * NEVER inferred from the email: the guest can edit that field at checkout,
   * and a stranger's reservation must not appear in someone else's dashboard.
   */
  customerId: UUID | null

  propertyId: UUID
  roomId: UUID
  /** Which product was sold — price and cancellation both come from it. */
  ratePlanId: UUID

  /** Snapshots, so history survives catalogue edits. */
  propertyName: string
  roomName: string
  ratePlanName: string
  city: string
  seed: ImageSeed

  /**
   * The cancellation TERMS as they stood when the guest booked. Frozen: a
   * partner tightening the policy tomorrow must not retroactively shrink a
   * refund somebody already agreed to.
   */
  cancellationPolicy: CancellationPolicy

  guest: BookingGuest

  checkIn: ISODate
  checkOut: ISODate
  /** Split adults/children (rule #28). */
  occupancy: Occupancy
  /** e.g. "15:00 – 16:00" */
  arrivalTime: string
  specialRequests: string

  addOns: BookingAddOn[]
  pricing: BookingPricing

  payment: {
    /** Fixed by the rate plan at booking time, never chosen by the guest. */
    mode: PaymentMode
    status: PaymentStatus
  }

  /**
   * Snapshot of the org's rate at booking time, in basis points. Renegotiating
   * a partner's rate must never rewrite what past bookings earned.
   */
  commissionRateBps: number
  /** `pricing.total × commissionRateBps / 10000`, frozen at booking time. */
  commissionAmount: Cents
  commissionStatus: CommissionStatus

  status: BookingStatus
  source: BookingSource

  /**
   * When a `pending` hold lapses. Non-null ONLY while `status` is `pending`.
   *
   * Pending bookings hold inventory, so without an expiry a script could open
   * reservations it never pays for and take an entire property off sale.
   * See docs/ARCHITECTURE.md §5 API6.
   */
  holdExpiresAt: ISODateTime | null

  /** Assigned by the property at check-in. */
  roomNo: string | null
  /** Property-side internal note. Never shown to the guest. */
  notes: string | null

  /** What actually happened, once it did. `null` until cancelled. */
  cancellation: Cancellation | null
}

/* ---------------------------------------------------------------- events -- */

/**
 * Append-only audit of every status change. Answers "who cancelled this, when,
 * and why" — which nothing in the prototype could, because `setBookingStatus`
 * simply overwrote the field with no guard and no record.
 */
/**
 * Who performed a transition.
 *
 * Partner roles are prefixed because `PartnerRole` already contains `admin`,
 * and an unprefixed union would store the platform's admin and a property's
 * own admin under the same value — indistinguishable afterwards, in exactly
 * the audit trail that exists to distinguish them.
 *
 * `system` is the cron: hold expiry, auto-complete, no-show sweep.
 */
export type BookingActor =
  | "guest"
  | "partner_admin"
  | "partner_manager"
  | "partner_staff"
  | "platform_admin"
  | "system"

export type BookingEvent = {
  id: UUID
  bookingId: UUID
  fromStatus: BookingStatus | null
  toStatus: BookingStatus
  actorId: UUID | null
  actor: BookingActor
  reason: string | null
  createdAt: ISODateTime
}

/** Maps a partner's role onto the actor recorded in the audit trail. */
export function partnerActor(role: PartnerRole): BookingActor {
  return `partner_${role}` as BookingActor
}
