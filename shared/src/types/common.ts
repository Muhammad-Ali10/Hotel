/* ============================================================================
 * Primitive aliases shared by every entity.
 * ========================================================================== */

/**
 * Money — ALWAYS integer minor units (cents). Never a float, never dollars.
 *
 * The frontend prototype stored dollars as plain numbers and rounded at every
 * step. That cannot survive contact with a payment provider: 15% of $2,432 is
 * $364.80, and rounding it to $365 loses $0.20 on every booking. Stripe works
 * in cents, so a dollars-based ledger can never be reconciled against it.
 *
 * Rules:
 *  - store and compute in cents
 *  - round ONCE, at the end of a calculation — never at each step
 *  - format only at the API edge
 *
 * See docs/ARCHITECTURE.md §1.1.
 */
export type Cents = number

/** Calendar date, `yyyy-mm-dd`. Timezone-free by design — see below. */
export type ISODate = string

/** Absolute instant, RFC 3339 with offset. */
export type ISODateTime = string

/** UUIDv7 primary key. Time-sortable, so index locality stays good. */
export type UUID = string

/**
 * IANA timezone name, e.g. `Asia/Tokyo`.
 *
 * Stay dates (`checkIn`/`checkOut`) are deliberately timezone-free — "the night
 * of 12 August" is the same night everywhere. But cancellation deadlines are
 * not: the public policy page promises "a 48-hour deadline for a 15:00 check-in
 * in Tokyo expires at 15:00 Tokyo time". That needs the property's own zone.
 */
export type TimeZone = string

/** 24-hour wall clock, `HH:mm`. Local to the property. */
export type TimeOfDay = string

/** Deterministic seed for placeholder imagery. Not business data. */
export type ImageSeed = string

/** Every table carries these. */
export type Timestamps = {
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

/**
 * Party composition (rule #28).
 *
 * Adults and children are counted separately because a room that sleeps four
 * adults and a room that sleeps two adults plus two children are not the same
 * room, and the property's own policy already promises "cots are free for
 * under-2s" — a promise a single `guests: number` cannot express.
 *
 * Ages are deliberately NOT collected in v1: child-rate bands are a pricing
 * engine of their own, and counting is enough to get capacity right.
 */
export type Occupancy = {
  adults: number
  children: number
}

/** Cursor-based page envelope. Offset pagination is not used — see §4b. */
export type Page<T> = {
  items: T[]
  /** Pass back as `cursor` to fetch the next page. `null` = last page. */
  nextCursor: string | null
}
