/* ============================================================================
 * Stayora — unified domain model.
 *
 * One shape per concept, shared by all three surfaces (public site, customer
 * dashboard, partner extranet). A booking made on the site is the same record
 * the guest cancels in the dashboard and the partner sees in the extranet.
 * ========================================================================== */

/* ---------------------------------------------------------------- hotels -- */

export type PropertyType = "Hotel" | "Resort"

export type Room = {
  id: string
  name: string
  description: string
  guests: number
  bed: string
  /** square metres */
  size: number
  features: string[]
  pricePerNight: number
  /** how many of this room type the property has */
  units: number
  seed: string
}

export type DiscountType = "percent" | "amount" | "freeNight"

/**
 * A structured discount — never a display string. `label` is derived by
 * `formatDiscount`, so a badge can render any type without parsing text.
 */
export type Discount = {
  type: DiscountType
  /** percent → 15 = 15% · amount → 50 = $50 off · freeNight → 3 = 3rd night free */
  value: number
  /** the promotion that produced it, when partner-driven */
  promotionId?: string
  /** channel restriction — public site only shows "all" */
  channel?: PromotionChannel
}

export type HotelPolicies = {
  /** 24h "15:00" */
  checkInTime: string
  /** 24h "12:00" */
  checkOutTime: string
  cancellation: string
  payment: string
  pets: string
  smoking: string
  children: string
}

export type TaxKind = "percent" | "perNight" | "perPersonPerNight"

export type TaxLine = {
  id: string
  label: string
  kind: TaxKind
  /** percent → 10 = 10% of subtotal · perNight → 25 = $25/night */
  value: number
  /** true = folded into the displayed rate · false = added at checkout */
  includedInDisplayPrice: boolean
  active: boolean
}

export type ValueAddUnit = "per stay" | "per night" | "per person"

/** A paid extra the partner sells and the guest buys at checkout. */
export type ValueAdd = {
  id: string
  name: string
  category: string
  description: string
  price: number
  unit: ValueAddUnit
  active: boolean
}

export type PhotoCategory = "Exterior" | "Interior" | "Rooms" | "Amenities" | "Dining"

export type Photo = {
  id: string
  category: PhotoCategory
  caption: string
  seed: string
}

/** Per-hotel availability rules — drives sold-out states and the date picker. */
export type Availability = {
  /** ISO yyyy-mm-dd dates the property is closed */
  closedDates: string[]
  minStay: number
  /** ISO date → nightly rate override */
  rateOverrides: Record<string, number>
}

export type Hotel = {
  id: string
  name: string
  city: string
  country: string
  address: string
  type: PropertyType
  /** lowest room rate — derived in the seed, never hand-written */
  pricePerNight: number
  discount?: Discount
  amenities: string[]
  description: string
  rooms: Room[]
  policies: HotelPolicies
  taxLines: TaxLine[]
  valueAdds: ValueAdd[]
  photos: Photo[]
  availability: Availability
  /** partner org id that manages this hotel in the extranet, if any */
  managedBy?: string
  /** image seed for the placeholder helper */
  seed: string
}

/** Rating + count are always derived from the review list — never stored. */
export type HotelRating = {
  rating: number
  reviewCount: number
  categories: ReviewCategories
}

/* --------------------------------------------------------------- reviews -- */

export type ReviewCategory =
  | "cleanliness"
  | "comfort"
  | "location"
  | "facilities"
  | "staff"

export type ReviewCategories = Record<ReviewCategory, number>

export const REVIEW_CATEGORIES: { key: ReviewCategory; label: string }[] = [
  { key: "cleanliness", label: "Cleanliness" },
  { key: "comfort", label: "Comfort" },
  { key: "location", label: "Location" },
  { key: "facilities", label: "Facilities" },
  { key: "staff", label: "Staff" },
]

/** Only `published` reviews are visible on the public site. */
export type ReviewStatus = "published" | "pending" | "flagged" | "rejected"

export type ReviewResponse = {
  text: string
  date: string
}

export type Review = {
  id: string
  hotelId: string
  /** set when the review came from a real stay → renders the Verified badge */
  bookingId?: string
  /** account that wrote it — undefined for imported/OTA reviews. */
  authorId?: string
  author: string
  authorSeed: string
  country: string
  roomName: string
  /** 1–5, the only rating scale in the product */
  rating: number
  categories: ReviewCategories
  title: string
  body: string
  /** ISO yyyy-mm-dd */
  date: string
  status: ReviewStatus
  response?: ReviewResponse
}

/* -------------------------------------------------------------- bookings -- */

export type BookingStatus =
  | "confirmed"
  | "pending"
  | "checked_in"
  | "checked_out"
  | "completed"
  | "cancelled"

export type BookingSource = "Direct" | "Booking.com" | "Expedia" | "Travel Agency"

export type RefundStatus = "full" | "partial" | "none" | "pending" | "processed"

export type Cancellation = {
  /** ISO yyyy-mm-dd */
  date: string
  reason: string
  by: "guest" | "hotel"
  refund: number
  refundStatus: RefundStatus
}

export type BookingGuest = {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
}

export type BookingAddOn = {
  id: string
  name: string
  price: number
  qty: number
}

export type PriceLine = {
  id: string
  label: string
  amount: number
}

/** Every money figure a booking shows anywhere comes from this block. */
export type BookingPricing = {
  nights: number
  ratePerNight: number
  roomSubtotal: number
  addOnsTotal: number
  subtotal: number
  discount?: PriceLine
  taxes: PriceLine[]
  taxTotal: number
  total: number
}

export type PaymentMethod = "card" | "property"
export type PaymentStatus = "paid" | "pending"

export type Booking = {
  /** STY-XXXXXX — the only booking id scheme in the product */
  id: string
  /**
   * The account the booking belongs to. Undefined for bookings that arrived
   * through an OTA or a guest checkout — those have a `guest` block but no
   * platform account behind it. Ownership is NEVER inferred from the email:
   * the guest can edit that field at checkout.
   */
  customerId?: string
  hotelId: string
  roomId: string
  /** snapshots taken at booking time so history survives catalog edits */
  hotelName: string
  roomName: string
  city: string
  seed: string
  guest: BookingGuest
  /** ISO yyyy-mm-dd */
  checkIn: string
  checkOut: string
  guests: number
  /** e.g. "15:00 – 16:00" */
  arrivalTime: string
  specialRequests: string
  addOns: BookingAddOn[]
  pricing: BookingPricing
  payment: { method: PaymentMethod; status: PaymentStatus }
  status: BookingStatus
  source: BookingSource
  /** assigned by the partner after check-in */
  roomNo?: string
  /** ISO datetime */
  createdAt: string
  cancellation?: Cancellation
  /** partner-side internal note */
  notes?: string
}

/* --------------------------------------------------------- notifications -- */

export type NotificationType = "booking" | "offer" | "review" | "system" | "message"

export type NotificationAudience = "customer" | "partner"

export type AppNotification = {
  id: string
  audience: NotificationAudience
  type: NotificationType
  title: string
  message: string
  /** ISO datetime */
  createdAt: string
  read: boolean
  /** in-app link to the referenced entity */
  href?: string
}

/* --------------------------------------------------------------- tickets -- */

export type TicketStatus = "open" | "in_progress" | "resolved"
export type TicketPriority = "low" | "medium" | "high"

export type TicketMessage = {
  id: string
  from: "user" | "support"
  author: string
  text: string
  /** ISO datetime */
  date: string
}

export type SupportTicket = {
  /** TKT-XXXX */
  id: string
  subject: string
  category: string
  priority: TicketPriority
  status: TicketStatus
  createdBy: NotificationAudience
  author: string
  email: string
  hotelId?: string
  bookingId?: string
  /** ISO datetime */
  createdAt: string
  updatedAt: string
  messages: TicketMessage[]
  seed: string
}

/* --------------------------------------------------------------- profile -- */

export type UserProfile = {
  /** Stable account id — what a booking, review or favourite is keyed to. */
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  city: string
  avatarSeed: string
  membership: string
  points: number
  /** ISO yyyy-mm-dd */
  joined: string
  preferences: string[]
}

export type UserSettings = {
  emailNotifications: boolean
  smsNotifications: boolean
  marketing: boolean
  twoFactor: boolean
  currency: string
  language: string
}

/* ------------------------------------------------------------ promotions -- */

export type PromotionStatus = "active" | "paused" | "draft"
export type PromotionChannel = "all" | "mobile" | "genius"

export type Promotion = {
  id: string
  name: string
  /** hotels this promotion applies to */
  hotelIds: string[]
  discount: Discount
  /** ISO yyyy-mm-dd */
  startDate: string
  endDate: string
  roomTypes: string
  minStay?: number
  bookings: number
  revenue: number
  status: PromotionStatus
  channel: PromotionChannel
}

/* ------------------------------------------------------- marketing / cms -- */

export type Destination = {
  id: string
  name: string
  properties: number
  seed: string
}

export type Testimonial = {
  id: string
  author: string
  role: string
  rating: number
  quote: string
  seed: string
}

export type Feature = {
  title: string
  description: string
  icon: string
}
