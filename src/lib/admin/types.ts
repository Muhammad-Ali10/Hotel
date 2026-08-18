/**
 * Domain types for the Stayora super-admin panel (`/admin`).
 *
 * Mirrors the "Super admin" Figma file. All data is mock — see
 * `src/data/admin/*` for the fixtures and `src/lib/admin/api/*` for the
 * swappable transport layer.
 *
 * Currency is USD platform-wide (Phase 1 decision D4): the Figma's PKR payout,
 * invoice and promotion rows were rewritten onto the canonical international
 * property set so every screen reads from one universe.
 */

import type { Trend } from "@/lib/extranet/types"

export type { Trend }

/* ------------------------------------------------------------------ shared */

/** Every list endpoint returns this shape so tables can page uniformly. */
export type Paginated<T> = {
  rows: T[]
  total: number
}

export type Money = number

/* ----------------------------------------------------------------- clients */

export type PlanTier = "Starter" | "Professional" | "Enterprise"

export type ClientStatus = "Active" | "Trial" | "Past Due" | "Suspended"

/** A tenant organisation — the hotel group that owns properties. */
export type Client = {
  id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  country: string
  plan: PlanTier
  status: ClientStatus
  joined: string
  /** Platform commission rate, e.g. 0.15 */
  commissionRate: number
  monthlyRevenue: Money
  occupancy: number
  seed: string
}

/* ------------------------------------------------------------------ guests */

export type GuestStatus = "Active" | "Suspended" | "Blocked"

/** A registered traveller who books rooms on the marketplace. */
export type Guest = {
  id: string
  name: string
  email: string
  phone: string
  country: string
  bookings: number
  totalSpent: Money
  status: GuestStatus
  joined: string
  seed: string
}

/* -------------------------------------------------------------- properties */

/**
 * Approval lifecycle. Resolves the Figma contradiction where Approve,
 * Request Changes and Re-approve all rendered at once (Phase 1, D6):
 *
 *   Draft ──▶ Pending ──▶ Active ⇄ Suspended
 *               │  ▲
 *               │  └── Changes Requested ──┐
 *               ├──▶ Changes Requested ────┘ (resubmit)
 *               └──▶ Rejected ─────────────┘ (resubmit)
 */
export type PropertyStatus =
  | "Draft"
  | "Pending"
  | "Active"
  | "Rejected"
  | "Changes Requested"
  | "Suspended"

export type VerificationStatus = "Not Submitted" | "Submitted" | "Reviewed"

export type RoomType = {
  id: string
  name: string
  description: string
  bed: string
  guests: number
  size: string
  basePrice: Money
  units: number
  booked: number
  view: string
}

export type TaxRule = {
  id: string
  name: string
  rate: string
  appliesTo: string
  includedIn: string
  scope: "Country-level" | "City-level" | "Platform-wide"
  status: "Active" | "Inactive"
  /** ISO country this rule applies to; `null` for platform-wide rules. */
  country: string | null
}

export type Property = {
  id: string
  name: string
  clientId: string
  city: string
  country: string
  stars: number
  rooms: number
  status: PropertyStatus
  occupancy: number
  adr: Money
  revenueToday: Money
  seed: string
}

/** Everything the property detail screen needs, on top of `Property`. */
export type PropertyDetail = Property & {
  type: string
  floors: number
  yearBuilt: number
  lastRenovated: number
  checkIn: string
  checkOut: string
  address: string
  description: string
  phone: string
  email: string
  website: string
  emergency: string
  verification: {
    status: VerificationStatus
    submittedBy: string
    uploadedAt: string
    duration: string
  }
  /** Set once an admin acts; drives the approval panel's resolved state. */
  decision: {
    by: string
    at: string
    note?: string
  } | null
  photos: string[]
  roomTypes: RoomType[]
  taxRules: TaxRule[]
}

/* ------------------------------------------------------------- managers */

export type ManagerRole =
  | "Owner"
  | "General Manager"
  | "Revenue Manager"
  | "Front Desk Manager"
  | "Staff"

export type ManagerStatus = "Active" | "Invited" | "Suspended"

/** A tenant-side staff account, managed from the admin panel. */
export type Manager = {
  id: string
  name: string
  email: string
  role: ManagerRole
  clientId: string
  propertyIds: string[]
  status: ManagerStatus
  lastLogin: string | null
  seed: string
}

/* -------------------------------------------------------- reservations */

export type ReservationStatus =
  | "Pending"
  | "Confirmed"
  | "Checked In"
  | "Checked Out"
  | "Cancelled"
  | "No-show"

export type BookingSource =
  | "Direct"
  | "Booking.com"
  | "Expedia"
  | "Travel Agency"

export type Reservation = {
  id: string
  guestName: string
  guestEmail: string
  guestPhone: string
  propertyId: string
  room: string
  checkIn: string
  checkOut: string
  guests: number
  source: BookingSource
  status: ReservationStatus
  total: Money
  paymentMethod: string
  createdAt: string
}

export type CancellationReasonCode =
  | "Guest request"
  | "Payment failed"
  | "Property closure"
  | "Overbooking"
  | "No-show"
  | "Suspected fraud"

export type Cancellation = {
  id: string
  reservationId: string
  guestName: string
  propertyId: string
  cancelledAt: string
  reason: CancellationReasonCode
  refund: "Full refund" | "Partial" | "No refund"
  refundAmount: Money
  originalTotal: Money
  cancelledBy: string
  note: string
}

/* --------------------------------------------------------------- inbox */

export type TicketPriority = "Low" | "Medium" | "High"
export type TicketStatus = "Open" | "In Progress" | "Resolved"

export type InboxMessage = {
  id: string
  author: string
  authorRole: "guest" | "staff" | "admin" | "system"
  at: string
  body: string
}

export type InboxThread = {
  id: string
  kind: "ticket" | "guest"
  subject: string
  guestName: string
  guestEmail: string
  propertyId: string
  bookingRef: string
  room: string
  priority: TicketPriority
  status: TicketStatus
  unread: boolean
  updatedAt: string
  messages: InboxMessage[]
  seed: string
}

/* ------------------------------------------------------------- reviews */

export type ReviewStatus = "Published" | "Flagged" | "Pending Review" | "Hidden"

export type Review = {
  id: string
  guestName: string
  rating: number
  propertyId: string
  status: ReviewStatus
  date: string
  title: string
  body: string
  response: string | null
  /** Set when AI moderation or a guest report flagged the review. */
  flagReason: string | null
  seed: string
}

/* ------------------------------------------------------------- finance */

export type RevenueRow = {
  propertyId: string
  revenueYtd: Money
  prevYear: Money
  bookings: number
  adr: Money
  revpar: Money
  occupancy: number
  growth: number
}

export type CommissionRow = {
  propertyId: string
  revenueYtd: Money
  rate: number
  commissionYtd: Money
  nextPayoutEst: Money
}

export type PayoutStatus = "Paid" | "Pending" | "Failed"

export type Payout = {
  id: string
  propertyId: string
  ownerName: string
  amount: Money
  method: string
  date: string
  status: PayoutStatus
  reference: string
  /** Populated only when `status === "Failed"`. */
  failureReason: string | null
}

export type CommissionInvoiceStatus = "Pending" | "Paid" | "Overdue" | "Void"

export type CommissionInvoice = {
  id: string
  propertyId: string
  ownerName: string
  subtotal: Money
  taxRate: number
  taxLabel: string
  total: Money
  issued: string
  due: string
  status: CommissionInvoiceStatus
  periodStart: string
  periodEnd: string
  bookings: number
}

/** Computed preview shown in step 2 of the Generate Invoice dialog. */
export type InvoicePreview = {
  invoiceNumber: string
  propertyId: string
  ownerName: string
  periodStart: string
  periodEnd: string
  transactions: number
  grossRevenue: Money
  commissionRate: number
  subtotal: Money
  taxRate: number
  taxLabel: string
  taxAmount: Money
  total: Money
  notes: string
}

/* ----------------------------------------------------------- analytics */

export type AnalyticsClientRow = {
  clientId: string
  properties: number
  revenue: Money
  bookings: number
  occupancy: number
  adr: Money
  reviewScore: number
  growth: number
}

export type DemandLevel = "High" | "Medium" | "Low"

export type DemandCity = {
  id: string
  city: string
  country: string
  searchVolume: number
  growth: number
  avgRate: Money
  occupancy: number
  properties: number
  level: DemandLevel
  topNationality: string
}

export type SeriesPoint = {
  label: string
  revenue: Money
  bookings: number
  occupancy?: number
}

/* ---------------------------------------------------------- promotions */

export type PromotionStatus = "Active" | "Scheduled" | "Paused" | "Ended"

export type DiscountTier = "High Discount" | "Moderate Discount" | "Low Discount"

export type PromotionKind =
  | "Seasonal Deal"
  | "Limited Time"
  | "Member Exclusive"
  | "Group Booking"
  | "Early Bird"
  | "Last Minute"
  | "Flash Sale"
  | "Holiday Special"

export type Promotion = {
  id: string
  name: string
  kind: PromotionKind
  city: string
  discount: number
  minStay: number
  propertyIds: string[]
  travelWindow: string
  status: PromotionStatus
  bookings: number
  clientId: string
}

export type RankingRow = {
  rank: number
  propertyId: string
  rating: number
  discount: number
  discountedPrice: Money
  originalPrice: Money
}

/* ------------------------------------------------------------- content */

export type ContentStatus = "Approved" | "Pending Review" | "Flagged"

export type ContentItem = {
  id: string
  propertyId: string
  score: number
  status: ContentStatus
  body: string
  updatedAt: string
  /** Why moderation flagged it — shown on the card when status is Flagged. */
  flagReason: string | null
}

/* --------------------------------------------------------------- audit */

export type AuditCategory =
  | "User"
  | "Property"
  | "Billing"
  | "Content"
  | "Security"
  | "System"

export type AuditEvent = {
  id: string
  action: string
  actorName: string
  actorRole: string
  targetName: string
  targetKind: string
  details: string
  category: AuditCategory
  at: string
}

/* ------------------------------------------------------------- billing */

export type SubscriptionStatus = "Active" | "Trial" | "Past Due" | "Cancelled"

export type Subscription = {
  id: string
  clientId: string
  plan: PlanTier
  status: SubscriptionStatus
  amount: Money
  interval: "Monthly" | "Yearly"
  nextBilling: string
  paymentMethod: string
}

export type BillingInvoiceStatus = "Paid" | "Pending" | "Overdue"

export type BillingInvoice = {
  id: string
  clientId: string
  description: string
  amount: Money
  status: BillingInvoiceStatus
  due: string
}

/* ------------------------------------------------------------ settings */

export type Integration = {
  id: string
  name: string
  description: string
  icon: string
  connected: boolean
}

export type PlatformSettings = {
  general: {
    platformName: string
    supportEmail: string
    defaultCurrency: string
    defaultLanguage: string
    timezone: string
  }
  plans: {
    defaultCommissionRate: number
    trialPeriodDays: number
    maxPropertiesFreePlan: number
  }
}

/* ------------------------------------------------------- notifications */

export type NotificationKind =
  | "client"
  | "security"
  | "billing"
  | "approval"
  | "review"

export type AdminNotification = {
  id: string
  kind: NotificationKind
  title: string
  detail: string
  at: string
  read: boolean
  href: string
}
