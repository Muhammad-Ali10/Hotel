/**
 * Domain logic — the single source of truth for money math, ratings, and
 * availability. Every surface (detail page, checkout, confirmation, dashboard,
 * extranet invoices) computes from these functions, so no two screens can
 * disagree about a number.
 */

import type {
  Availability,
  Booking,
  BookingAddOn,
  BookingPricing,
  Discount,
  Hotel,
  HotelRating,
  PriceLine,
  Promotion,
  Review,
  ReviewCategories,
  ReviewCategory,
  Room,
  TaxLine,
  ValueAdd,
} from "@/types"
import { REVIEW_CATEGORIES } from "@/types"

/* ----------------------------------------------------------------- dates -- */

const DAY_MS = 86_400_000

/** Parse an ISO yyyy-mm-dd as a *local* date (avoids UTC off-by-one). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function toISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function addDays(iso: string, days: number): string {
  return toISODate(new Date(parseISODate(iso).getTime() + days * DAY_MS))
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const n = Math.round(
    (parseISODate(checkOut).getTime() - parseISODate(checkIn).getTime()) / DAY_MS
  )
  return Math.max(n, 0)
}

/** Every ISO date in [checkIn, checkOut) — the nights actually slept. */
export function datesInRange(checkIn: string, checkOut: string): string[] {
  const out: string[] = []
  const n = nightsBetween(checkIn, checkOut)
  for (let i = 0; i < n; i++) out.push(addDays(checkIn, i))
  return out
}

/** Formats a stay as "Jun 25 – Jun 27, 2026". */
export function formatStay(checkIn: string, checkOut: string, locale = "en-US") {
  const a = parseISODate(checkIn)
  const b = parseISODate(checkOut)
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  return `${a.toLocaleDateString(locale, opts)} – ${b.toLocaleDateString(locale, {
    ...opts,
    year: "numeric",
  })}`
}

/** "15:00" → "3:00 PM" */
export function formatTime24(value: string, locale = "en-US") {
  const [h, m] = value.split(":").map(Number)
  const d = new Date(2000, 0, 1, h ?? 0, m ?? 0)
  return d.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
}

/* ------------------------------------------------------------- discounts -- */

export function formatDiscount(discount: Discount): string {
  switch (discount.type) {
    case "percent":
      return `${discount.value}% OFF`
    case "amount":
      return `$${discount.value} OFF`
    case "freeNight":
      return `${ordinal(discount.value)} Night Free`
  }
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

/** The amount a discount removes from a room subtotal. */
export function discountAmount(
  discount: Discount | undefined,
  roomSubtotal: number,
  nights: number,
  ratePerNight: number
): number {
  if (!discount) return 0
  switch (discount.type) {
    case "percent":
      return Math.round((roomSubtotal * discount.value) / 100)
    case "amount":
      return Math.min(discount.value, roomSubtotal)
    case "freeNight":
      // e.g. value 3 → every 3rd night is free
      return Math.floor(nights / discount.value) * ratePerNight
  }
}

/** The pre-discount price, for the strikethrough. Undefined when no discount. */
export function originalPrice(hotel: Pick<Hotel, "pricePerNight" | "discount">) {
  const d = hotel.discount
  if (!d || d.type !== "percent") return undefined
  return Math.round(hotel.pricePerNight / (1 - d.value / 100))
}

/* ------------------------------------------------------------------ tax -- */

export function taxLinesFor(
  hotel: Pick<Hotel, "taxLines">,
  opts: { subtotal: number; nights: number; guests: number; includedOnly?: boolean }
): PriceLine[] {
  return hotel.taxLines
    .filter((t) => t.active)
    .filter((t) =>
      opts.includedOnly === undefined ? true : t.includedInDisplayPrice === opts.includedOnly
    )
    .map((t) => ({
      id: t.id,
      label: t.label,
      amount: taxAmount(t, opts),
    }))
    .filter((l) => l.amount > 0)
}

function taxAmount(
  tax: TaxLine,
  { subtotal, nights, guests }: { subtotal: number; nights: number; guests: number }
): number {
  switch (tax.kind) {
    case "percent":
      return Math.round((subtotal * tax.value) / 100)
    case "perNight":
      return Math.round(tax.value * nights)
    case "perPersonPerNight":
      return Math.round(tax.value * nights * guests)
  }
}

/* -------------------------------------------------------------- pricing -- */

export function addOnsTotal(addOns: BookingAddOn[]): number {
  return addOns.reduce((sum, a) => sum + a.price * a.qty, 0)
}

/** Resolve an add-on's price for a given stay (unit-aware). */
export function valueAddPrice(
  valueAdd: ValueAdd,
  { nights, guests }: { nights: number; guests: number }
): number {
  switch (valueAdd.unit) {
    case "per stay":
      return valueAdd.price
    case "per night":
      return valueAdd.price * nights
    case "per person":
      return valueAdd.price * guests
  }
}

/** The nightly rate for a room on a given date, honouring rate overrides. */
export function rateForDate(hotel: Hotel, room: Room, iso: string): number {
  const override = hotel.availability.rateOverrides[iso]
  if (override === undefined) return room.pricePerNight
  // overrides are expressed against the hotel's base (cheapest) room; keep the
  // room's relative positioning so a suite stays priced above a standard room
  const ratio = room.pricePerNight / hotel.pricePerNight
  return Math.round(override * ratio)
}

/**
 * THE price calculation. Detail page, checkout, confirmation, dashboard and
 * extranet invoices all call this — there is no second implementation.
 */
export function priceBooking(input: {
  hotel: Hotel
  room: Room
  checkIn: string
  checkOut: string
  guests: number
  addOns?: BookingAddOn[]
}): BookingPricing {
  const { hotel, room, checkIn, checkOut, guests } = input
  const addOns = input.addOns ?? []
  const nights = nightsBetween(checkIn, checkOut)

  const roomSubtotal = datesInRange(checkIn, checkOut).reduce(
    (sum, iso) => sum + rateForDate(hotel, room, iso),
    0
  )
  const ratePerNight = nights > 0 ? Math.round(roomSubtotal / nights) : room.pricePerNight

  const extras = addOnsTotal(addOns)

  const discountValue = discountAmount(hotel.discount, roomSubtotal, nights, ratePerNight)
  const discount: PriceLine | undefined = hotel.discount
    ? {
        id: hotel.discount.promotionId ?? "discount",
        label: formatDiscount(hotel.discount),
        amount: -discountValue,
      }
    : undefined

  const subtotal = roomSubtotal - discountValue + extras
  const taxes = taxLinesFor(hotel, { subtotal, nights, guests })
  const taxTotal = taxes.reduce((sum, t) => sum + t.amount, 0)

  return {
    nights,
    ratePerNight,
    roomSubtotal,
    addOnsTotal: extras,
    subtotal,
    discount,
    taxes,
    taxTotal,
    total: subtotal + taxTotal,
  }
}

/* -------------------------------------------------------------- ratings -- */

const EMPTY_CATEGORIES: ReviewCategories = {
  cleanliness: 0,
  comfort: 0,
  location: 0,
  facilities: 0,
  staff: 0,
}

/** Derives a hotel's headline rating from its published reviews. Never stored. */
export function deriveRating(reviews: Review[]): HotelRating {
  const published = reviews.filter((r) => r.status === "published")
  if (published.length === 0) {
    return { rating: 0, reviewCount: 0, categories: { ...EMPTY_CATEGORIES } }
  }

  const rating = round1(
    published.reduce((sum, r) => sum + r.rating, 0) / published.length
  )

  const categories = { ...EMPTY_CATEGORIES }
  for (const { key } of REVIEW_CATEGORIES) {
    categories[key] = round1(
      published.reduce((sum, r) => sum + (r.categories[key] || r.rating), 0) /
        published.length
    )
  }

  return { rating, reviewCount: published.length, categories }
}

export function categoryLabel(key: ReviewCategory): string {
  return REVIEW_CATEGORIES.find((c) => c.key === key)?.label ?? key
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/* --------------------------------------------------------- availability -- */

export type StayCheck =
  | { ok: true }
  | { ok: false; reason: "closed" | "minStay" | "invalid"; message: string }

/** Validates a stay against the partner's open/close + min-stay rules. */
export function checkStay(
  availability: Availability,
  checkIn: string,
  checkOut: string
): StayCheck {
  const nights = nightsBetween(checkIn, checkOut)
  if (nights <= 0) {
    return { ok: false, reason: "invalid", message: "Check-out must be after check-in." }
  }
  if (nights < availability.minStay) {
    return {
      ok: false,
      reason: "minStay",
      message: `This property has a ${availability.minStay}-night minimum stay.`,
    }
  }
  const closed = datesInRange(checkIn, checkOut).find((d) =>
    availability.closedDates.includes(d)
  )
  if (closed) {
    return {
      ok: false,
      reason: "closed",
      message: "Some of your dates are sold out at this property.",
    }
  }
  return { ok: true }
}

export function isSoldOut(availability: Availability, checkIn: string, checkOut: string) {
  const result = checkStay(availability, checkIn, checkOut)
  return !result.ok && result.reason === "closed"
}

/* --------------------------------------------------------- promotions --- */

/** The discount a hotel should currently advertise, derived from promotions. */
export function activeDiscountFor(
  hotelId: string,
  promotions: Promotion[],
  today: string
): Discount | undefined {
  const applicable = promotions.filter(
    (p) =>
      p.status === "active" &&
      p.channel === "all" &&
      p.hotelIds.includes(hotelId) &&
      p.startDate <= today &&
      p.endDate >= today
  )
  if (applicable.length === 0) return undefined
  // best offer for the guest wins; percent beats amount at equal face value
  return applicable
    .map((p) => ({ ...p.discount, promotionId: p.id }))
    .sort((a, b) => rank(b) - rank(a))[0]
}

function rank(d: Discount): number {
  return d.type === "percent" ? d.value * 10 : d.value
}

/* ---------------------------------------------------------- booking ids -- */

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** STY-XXXXXX — the only booking reference scheme in the product. */
export function makeBookingRef(random: () => number = Math.random): string {
  let out = ""
  for (let i = 0; i < 6; i++) {
    out += REF_ALPHABET[Math.floor(random() * REF_ALPHABET.length)]
  }
  return `STY-${out}`
}

export function makeTicketRef(random: () => number = Math.random): string {
  return `TKT-${String(Math.floor(random() * 9000) + 1000)}`
}

/* ------------------------------------------------------------- bookings -- */

export function guestName(booking: Booking): string {
  return `${booking.guest.firstName} ${booking.guest.lastName}`.trim()
}

export function isUpcoming(booking: Booking, today: string): boolean {
  return (
    booking.status !== "cancelled" &&
    booking.status !== "completed" &&
    booking.checkIn >= today
  )
}

/** Refund due for a cancellation, per the property's cancellation window. */
export function refundFor(booking: Booking, today: string): {
  refund: number
  refundStatus: "full" | "partial" | "none"
} {
  const daysToArrival = Math.round(
    (parseISODate(booking.checkIn).getTime() - parseISODate(today).getTime()) / DAY_MS
  )
  if (daysToArrival >= 2) return { refund: booking.pricing.total, refundStatus: "full" }
  if (daysToArrival >= 0)
    return { refund: Math.round(booking.pricing.total * 0.5), refundStatus: "partial" }
  return { refund: 0, refundStatus: "none" }
}
