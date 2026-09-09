import type { Cents } from "../types/common"
import type { BookingAddOn, BookingPricing, PriceLine } from "../types/booking"
import type { Discount } from "../types/promotion"
import type { ResolvedNight, ValueAddUnit } from "../types/property"
import { clampNonNegative, percentOf, roundCents, sumCents } from "./money"

/* ============================================================================
 * THE price calculation. There is no second implementation.
 *
 * Order of operations (rule #11 — no tax layer at all):
 *
 *   roomSubtotal = sum of each night's rate
 *   discount     = applied to roomSubtotal only
 *   addOnsTotal  = sum of each add-on, resolved for nights × guests × qty
 *   TOTAL        = roomSubtotal − discount + addOnsTotal
 *
 * Every figure is cents, and the total is the SUM OF THE ROUNDED LINES — so
 * the breakdown a guest reads always adds up to what they are charged.
 * ========================================================================== */

/* ----------------------------------------------------------------- room -- */

/** Sum of the per-night rates. Nights already carry their resolved rate. */
export function roomSubtotal(nights: readonly ResolvedNight[]): Cents {
  return sumCents(nights.map((n) => n.rate))
}

/**
 * Average nightly rate — **display only**.
 *
 * Never used to compute a total: per-date rates differ, so multiplying the
 * average back out would not reproduce `roomSubtotal`. It exists so a screen
 * can say "$725 / night" for a stay whose nights are $700, $750 and $725.
 */
export function averageRatePerNight(subtotal: Cents, nights: number): Cents {
  return nights > 0 ? roundCents(subtotal / nights) : 0
}

/* ------------------------------------------------------------- discounts -- */

/**
 * What a discount removes from the room subtotal.
 *
 * `free_night` gives away the CHEAPEST nights (rule #19). With per-date rates
 * now first-class, "3rd night free" has to name a night: taking the average —
 * or worse, the dearest — makes a promotion cost the partner most exactly when
 * inventory is scarcest and discounting is least needed. The guest still gets
 * the promised number of free nights.
 */
export function discountAmount(
  discount: Discount | undefined,
  stay: { roomSubtotal: Cents; nights: readonly ResolvedNight[] }
): Cents {
  if (!discount) return 0

  switch (discount.type) {
    case "percent":
      return percentOf(stay.roomSubtotal, discount.value)

    case "amount":
      // `value` is already cents. Never more than the room is worth.
      return Math.min(discount.value, stay.roomSubtotal)

    case "free_night": {
      // value = 3 → every 3rd night free → floor(nights / 3) free nights.
      if (discount.value <= 0) return 0
      const freeCount = Math.floor(stay.nights.length / discount.value)
      if (freeCount <= 0) return 0
      const cheapestFirst = stay.nights.map((n) => n.rate).sort((a, b) => a - b)
      return sumCents(cheapestFirst.slice(0, freeCount))
    }
  }
}

/**
 * The struck-through "was" price for a stay whose dates are known.
 *
 * Works for every discount type (rule #7) because it reads the real subtotal
 * rather than reverse-engineering it from a percentage — which is why the
 * prototype could only ever strike through percent offers.
 *
 * Returns `null` when there is nothing to strike through.
 */
export function strikethroughFor(
  pricing: Pick<BookingPricing, "roomSubtotal" | "discount">
): { original: Cents; final: Cents } | null {
  const reduction = pricing.discount ? Math.abs(pricing.discount.amount) : 0
  if (reduction <= 0) return null
  return {
    original: pricing.roomSubtotal,
    final: clampNonNegative(pricing.roomSubtotal - reduction),
  }
}

/**
 * The "from $X / night" figure on a listing card, where no dates are known yet.
 *
 * Only a `percent` offer can be expressed per night: `amount` is per stay and
 * `free_night` depends on how long the stay is, so neither has a meaningful
 * nightly equivalent. For those the card shows the plain rate and lets the
 * promotion badge carry the offer — quoting a made-up nightly figure would be
 * a price the guest can never actually be charged.
 */
export function nightlyDisplayPrice(
  baseRate: Cents,
  discount?: Discount
): { original: Cents | null; final: Cents } {
  if (!discount || discount.type !== "percent") {
    return { original: null, final: baseRate }
  }
  return {
    original: baseRate,
    final: clampNonNegative(baseRate - percentOf(baseRate, discount.value)),
  }
}

/* -------------------------------------------------------------- add-ons -- */

/**
 * Resolves one add-on's price for a stay (rules #10, #23).
 *
 * The unit resolves first — against nights and party size — and `qty` multiplies
 * the result. So a $120 spa package, `per_person`, 2 guests, qty 2 is $480:
 * two treatments each.
 *
 * `per_person_per_night` is the unit the prototype lacked, which is why "Daily
 * breakfast" charged $32 per guest ONCE for a three-night stay — $64 for six
 * breakfasts.
 */
export function valueAddPrice(
  valueAdd: { price: Cents; unit: ValueAddUnit },
  stay: { nights: number; guests: number },
  qty = 1
): Cents {
  const perUnit = resolveUnit(valueAdd.price, valueAdd.unit, stay)
  return perUnit * Math.max(0, Math.trunc(qty))
}

function resolveUnit(
  price: Cents,
  unit: ValueAddUnit,
  stay: { nights: number; guests: number }
): Cents {
  const nights = Math.max(0, stay.nights)
  const guests = Math.max(0, stay.guests)
  switch (unit) {
    case "per_stay":
      return price
    case "per_night":
      return price * nights
    case "per_person":
      return price * guests
    case "per_person_per_night":
      return price * guests * nights
  }
}

/** Sum of the already-resolved add-on amounts on a booking. */
export function addOnsTotal(addOns: readonly Pick<BookingAddOn, "amount">[]): Cents {
  return sumCents(addOns.map((a) => a.amount))
}

/* --------------------------------------------------------------- booking -- */

export type PriceBookingInput = {
  /** One entry per night, each carrying its resolved rate. */
  nights: readonly ResolvedNight[]
  guests: number
  /** Already resolved through `valueAddPrice`. */
  addOns: readonly BookingAddOn[]
  discount?: Discount
}

/**
 * Builds the frozen price block a booking carries for life.
 *
 * The server runs this at quote time and again at write time; the client never
 * supplies a total. See docs/ARCHITECTURE.md §5 (price tampering).
 */
export function priceBooking(input: PriceBookingInput): BookingPricing {
  const nightCount = input.nights.length
  const subtotal = roomSubtotal(input.nights)
  const extras = addOnsTotal(input.addOns)

  const reduction = discountAmount(input.discount, {
    roomSubtotal: subtotal,
    nights: input.nights,
  })

  const discountLine: PriceLine | undefined =
    reduction > 0 && input.discount
      ? {
          id: input.discount.promotionId ?? "discount",
          label: discountLabel(input.discount),
          // Negative, so a breakdown can be summed straight down the column.
          amount: -reduction,
        }
      : undefined

  return {
    nights: nightCount,
    nightlyRates: input.nights.map((n) => n.rate),
    ratePerNight: averageRatePerNight(subtotal, nightCount),
    roomSubtotal: subtotal,
    addOnsTotal: extras,
    ...(discountLine ? { discount: discountLine } : {}),
    total: clampNonNegative(subtotal - reduction + extras),
  }
}

/**
 * Machine-readable label for a discount badge. Kept in the domain so the
 * public site, the checkout and the partner's promotion screen cannot describe
 * the same offer differently.
 */
export function discountLabel(discount: Discount): string {
  switch (discount.type) {
    case "percent":
      return `${discount.value}% OFF`
    case "amount":
      return `$${Math.round(discount.value / 100)} OFF`
    case "free_night":
      return `${ordinal(discount.value)} Night Free`
  }
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"]
  const v = n % 100
  return n + (suffixes[(v - 20) % 10] ?? suffixes[v] ?? suffixes[0]!)
}
