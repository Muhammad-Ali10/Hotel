import type { HotelPolicies, TaxLine, ValueAdd } from "@/types"

/**
 * The demo's fixed "today". Seed data is dated relative to this constant so the
 * scenario is identical on every machine and on every render — a moving `new
 * Date()` inside the seed would desync server and client rendering.
 * Runtime actions (creating a booking, replying to a review) use the real clock.
 */
export const TODAY = "2026-07-16"

/** The partner organisation that signs in to the extranet. */
export const PARTNER_ORG = {
  id: "aurora",
  name: "Aurora Hospitality",
  /** Hotels from the public catalogue that this partner manages. */
  hotelIds: [
    "the-ritz-carlton",
    "four-seasons",
    "one-and-only",
    "aman-tokyo",
    "the-peninsula",
  ],
  /** The property pre-selected in the extranet topbar. */
  activeHotelId: "the-ritz-carlton",
  /** Platform commission, quoted identically on every finance screen. */
  commissionRate: 12,
  /** Commission a property must accept to qualify as a Preferred Partner. */
  preferredCommissionRate: 15,
} as const

/**
 * House rules. Check-in 15:00 / check-out 12:00 is stated once here and read by
 * the public house-rules block, the confirmation page, and all three extranet
 * policy screens — previously each said something different.
 */
export const defaultPolicies: HotelPolicies = {
  checkInTime: "15:00",
  checkOutTime: "12:00",
  cancellation: "Free cancellation up to 48 hours before check-in. Cancel within 48 hours and 50% of the total is refunded.",
  payment: "Pay securely now by card, or pay at the property on arrival.",
  pets: "Pets allowed on request — $35 per pet, per night.",
  smoking: "Non-smoking property. Smoking is permitted in designated outdoor areas.",
  children: "Children of all ages are welcome. Cots are free for under-2s.",
}

/**
 * Tax and charge lines. The public reserve card, checkout, confirmation and the
 * extranet invoices all price from this list — it replaces the flat 12% that
 * used to be hardcoded in three separate components.
 */
export const defaultTaxLines: TaxLine[] = [
  {
    id: "vat",
    label: "VAT / GST (10%)",
    kind: "percent",
    value: 10,
    includedInDisplayPrice: false,
    active: true,
  },
  {
    id: "service",
    label: "Service charge (5%)",
    kind: "percent",
    value: 5,
    includedInDisplayPrice: false,
    active: true,
  },
  {
    id: "city-tax",
    label: "City tax ($3.50 per guest, per night)",
    kind: "perPersonPerNight",
    value: 3.5,
    includedInDisplayPrice: false,
    active: true,
  },
]

/** Resorts add a nightly resort fee on top of the standard charges. */
export const resortTaxLines: TaxLine[] = [
  ...defaultTaxLines,
  {
    id: "resort-fee",
    label: "Resort fee ($25 per night)",
    kind: "perNight",
    value: 25,
    includedInDisplayPrice: false,
    active: true,
  },
]

/**
 * Paid extras the partner sells in Rates → Value-adds and the guest buys in the
 * checkout add-ons step. One list, both surfaces.
 */
export const defaultValueAdds: ValueAdd[] = [
  {
    id: "airport-transfer",
    name: "Airport transfer",
    category: "Transport",
    description: "Private chauffeured pick-up and drop-off.",
    price: 65,
    unit: "per stay",
    active: true,
  },
  {
    id: "early-check-in",
    name: "Early check-in",
    category: "Convenience",
    description: "Guaranteed access to your room from 11:00 AM.",
    price: 35,
    unit: "per stay",
    active: true,
  },
  {
    id: "breakfast",
    name: "Daily breakfast",
    category: "Food & Drink",
    description: "Full à la carte breakfast for every guest.",
    price: 32,
    unit: "per person",
    active: true,
  },
  {
    id: "spa-package",
    name: "Spa package",
    category: "Wellness",
    description: "60-minute signature treatment per guest.",
    price: 120,
    unit: "per person",
    active: true,
  },
  {
    id: "champagne",
    name: "Champagne on arrival",
    category: "Food & Drink",
    description: "Chilled bottle and hand-dipped strawberries in your room.",
    price: 85,
    unit: "per stay",
    active: true,
  },
  {
    id: "late-checkout",
    name: "Late check-out",
    category: "Convenience",
    description: "Keep your room until 4:00 PM.",
    price: 45,
    unit: "per stay",
    active: true,
  },
]

/** Arrival-time options offered at checkout, anchored to the check-in policy. */
export const arrivalTimeSlots = [
  "15:00 – 16:00",
  "16:00 – 17:00",
  "17:00 – 18:00",
  "18:00 – 20:00",
  "20:00 – 22:00",
  "After 22:00",
  "I'm not sure yet",
]
