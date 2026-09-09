import type { ISODate, ISODateTime, TimeOfDay, TimeZone } from "../types/common"

/* ============================================================================
 * Calendar maths.
 *
 * Two different kinds of time live here, and conflating them is the bug this
 * file exists to prevent:
 *
 *   - A STAY is calendar dates. "The night of 12 August" is the same night in
 *     every timezone, so `checkIn`/`checkOut` are plain `yyyy-mm-dd` and all
 *     night arithmetic is timezone-free.
 *
 *   - A DEADLINE is an instant. The public policy page promises that "a 48-hour
 *     deadline for a 15:00 check-in in Tokyo expires at 15:00 Tokyo time two
 *     days before" — that needs the property's own wall clock.
 * ========================================================================== */

const DAY_MS = 86_400_000
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

/* --------------------------------------------------------- calendar days -- */

export function isValidISODate(value: string): value is ISODate {
  if (!ISO_DATE_RE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  // Rejects 2026-02-30, which Date would silently roll to 2026-03-02.
  return !Number.isNaN(d.getTime()) && toISODate(d) === value
}

export function assertISODate(value: string, label = "date"): asserts value is ISODate {
  if (!isValidISODate(value)) {
    throw new TypeError(`${label} must be a valid yyyy-mm-dd date, received: ${value}`)
  }
}

/** Parses to UTC midnight. Never uses the host machine's timezone. */
export function parseISODate(iso: ISODate): Date {
  assertISODate(iso)
  return new Date(`${iso}T00:00:00.000Z`)
}

export function toISODate(date: Date): ISODate {
  return date.toISOString().slice(0, 10) as ISODate
}

export function addDays(iso: ISODate, days: number): ISODate {
  return toISODate(new Date(parseISODate(iso).getTime() + days * DAY_MS))
}

/** Nights between two dates. Negative or zero means an invalid stay. */
export function nightsBetween(checkIn: ISODate, checkOut: ISODate): number {
  return Math.round((parseISODate(checkOut).getTime() - parseISODate(checkIn).getTime()) / DAY_MS)
}

/**
 * The nights a stay occupies: `[checkIn, checkOut)`.
 *
 * The departure date is NOT included — the guest leaves that morning, so that
 * night is free for someone else. Getting this wrong silently halves a
 * property's sellable inventory on every changeover day.
 */
export function datesInRange(checkIn: ISODate, checkOut: ISODate): ISODate[] {
  const nights = nightsBetween(checkIn, checkOut)
  if (nights <= 0) return []
  const out: ISODate[] = []
  for (let i = 0; i < nights; i++) out.push(addDays(checkIn, i))
  return out
}

/** Whole days from `from` to `to`. Negative when `to` is in the past. */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / DAY_MS)
}

/* ------------------------------------------------------- zoned instants -- */

export function isValidTimeOfDay(value: string): value is TimeOfDay {
  return TIME_RE.test(value)
}

/**
 * How far ahead of UTC `timezone` is at `instant`, in milliseconds.
 *
 * Derived from `Intl` rather than a lookup table so it follows the runtime's
 * IANA database — including DST transitions and historical offset changes.
 */
function zoneOffsetMs(instant: Date, timezone: TimeZone): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant)

  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const part = parts.find((p) => p.type === type)
    if (!part) throw new RangeError(`Unsupported timezone: ${timezone}`)
    return Number(part.value)
  }

  const asIfUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  )
  // Milliseconds are not in the formatted parts, so compare on whole seconds.
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000
}

/**
 * Turns a wall-clock time in a given zone into an absolute instant.
 *
 * Done by guessing the instant as if the wall clock were UTC, measuring the
 * zone's offset at that guess, correcting, and re-measuring once. The second
 * pass matters on DST boundaries, where the offset at the guess differs from
 * the offset at the corrected instant.
 */
export function zonedWallClockToInstant(
  date: ISODate,
  time: TimeOfDay,
  timezone: TimeZone
): Date {
  assertISODate(date)
  if (!isValidTimeOfDay(time)) {
    throw new TypeError(`time must be HH:mm, received: ${time}`)
  }
  const [hh, mm] = time.split(":").map(Number) as [number, number]
  const [y, m, d] = date.split("-").map(Number) as [number, number, number]

  const asUtc = Date.UTC(y, m - 1, d, hh, mm)
  const firstPass = asUtc - zoneOffsetMs(new Date(asUtc), timezone)
  const secondPass = asUtc - zoneOffsetMs(new Date(firstPass), timezone)
  return new Date(secondPass)
}

export function toISODateTime(date: Date): ISODateTime {
  return date.toISOString() as ISODateTime
}

/**
 * The exact instant a stay begins — the check-in date at the property's
 * check-in time, in the property's own zone.
 *
 * Every cancellation deadline is measured backwards from here.
 */
export function checkInInstant(input: {
  checkIn: ISODate
  checkInTime: TimeOfDay
  timezone: TimeZone
}): Date {
  return zonedWallClockToInstant(input.checkIn, input.checkInTime, input.timezone)
}
