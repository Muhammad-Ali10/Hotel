/**
 * Domain types for the Stayora partner extranet (hotel property-management
 * dashboard). Mirrors the "Aurora Hospitality" Figma design. All data is mock.
 */

export type Trend = "up" | "down" | "flat"

/** A KPI / stat tile value. */
export type Stat = {
  label: string
  value: string
  /** e.g. "+14.3%" */
  delta?: string
  trend?: Trend
  /** e.g. "vs yesterday" */
  caption?: string
  /** lucide icon name */
  icon?: string
}

export type Property = {
  id: string
  name: string
  city: string
  country: string
  rooms: number
  occupancy: number
  adr: number
  revenueToday: number
  rating: number
  status: "Active" | "Inactive"
  seed: string
}

export type ReservationStatus =
  | "Confirmed"
  | "Checked In"
  | "Checked Out"
  | "Cancelled"
  | "Pending"

export type Reservation = {
  id: string
  guest: string
  email: string
  room: string
  roomNo: string
  checkIn: string
  checkOut: string
  guests: number
  source: string
  status: ReservationStatus
  total: number
  property: string
  createdAt: string
  notes: string
}

export type Cancellation = {
  id: string
  guest: string
  room: string
  originalDates: string
  cancelledOn: string
  reason: string
  by: "Guest" | "Hotel"
  total: number
  refund: number
  refundStatus: "Full Refund" | "Partial" | "No Refund" | "Pending" | "Processed"
}

export type CheckIn = {
  guest: string
  roomNo: string
  room: string
  inDays: number
}

export type PendingAction = {
  id: string
  title: string
  meta: string
  icon: string
}

export type Tip = {
  id: string
  title: string
  cta: string
  icon: string
}

export type RatePlan = {
  id: string
  name: string
  price: number
  cancellation: string
  inclusion: string
  roomTypes: number
  status: "Active" | "Draft"
}

export type Promotion = {
  id: string
  name: string
  discount: string
  period: string
  roomTypes: string
  bookings: number
  revenue: number
  status: "Active" | "Paused" | "Draft"
}

export type Opportunity = {
  id: string
  title: string
  description: string
  impact: "High" | "Medium" | "Low"
  cta: string
  icon: string
}

export type ReviewStatus = "Approved" | "Pending" | "Flagged" | "Rejected"

export type Review = {
  id: string
  guest: string
  rating: number
  daysAgo: number
  status: ReviewStatus
  property: string
  room: string
  bookingId: string
  title: string
  body: string
  response?: string
  seed: string
}

export type Conversation = {
  id: string
  guest: string
  channel: string
  room: string
  property: string
  preview: string
  time: string
  unread: boolean
  kind: "guest" | "support"
  seed: string
}

export type Message = {
  id: string
  from: "guest" | "host"
  text: string
  time: string
}

export type RevenueRow = {
  property: string
  city: string
  revenue: number
  bookings: number
  adr: number
  revpar: number
  occupancy: number
  growth: number
}

export type SourceSlice = {
  label: string
  value: number
}

export type SeriesPoint = {
  label: string
  /** primary value (revenue) */
  value: number
  /** optional secondary value (bookings) */
  secondary?: number
}

export type TeamUser = {
  id: string
  name: string
  email: string
  role: "Admin" | "Manager" | "Staff"
  status: "Active" | "Invited"
  lastLogin: string
  seed: string
}

export type ToggleSetting = {
  id: string
  label: string
  description: string
  enabled: boolean
}

export type RoomType = {
  id: string
  name: string
  price: number
  description: string
  bed: string
  guests: number
  size: number
  units: number
  booked: number
  available: number
  amenities: string[]
  seed: string
}

export type AmenityItem = { name: string; enabled: boolean }
export type AmenityGroup = { category: string; icon: string; items: AmenityItem[] }

export type Photo = {
  id: string
  category: "Exterior" | "Interior" | "Rooms" | "Amenities" | "Dining"
  caption: string
  seed: string
}

export type Policy = {
  id: string
  title: string
  body: string
  icon: string
}

export type Transaction = {
  id: string
  date: string
  guest: string
  property: string
  room: string
  amount: number
  commission: number
  net: number
  channel: string
  status: "Completed" | "Pending" | "Refunded"
}

export type CommissionReport = {
  id: string
  property: string
  month: string
  status: "Paid" | "Pending"
  grossRevenue: number
  rate: number
  commission: number
  netToOwner: number
  bookings: number
}

export type Payout = {
  id: string
  date: string
  property: string
  amount: number
  method: string
  reference: string
  invoice: string
  status: "Paid" | "Pending" | "Failed"
}

export type Invoice = {
  id: string
  issued: string
  due: string
  property: string
  subtotal: number
  tax: number
  total: number
  status: "Paid" | "Outstanding" | "Overdue"
}

export type CalendarBooking = {
  id: string
  day: number
  guest: string
  room: string
}

export type AvailabilityDay = {
  date: string
  label: string
  availability: number
}

export type OpenCloseRoom = {
  id: string
  roomType: string
  open: number
  closed: number
  upcomingClosure: string
}

export type RestrictionRule = {
  id: string
  name: string
  appliesTo: string
  value: string
  status: "Active" | "Draft"
}

export type PricingRow = {
  guests: number
  prices: (number | null)[]
}

export type CountryRate = {
  id: string
  country: string
  code: string
  rate: string
  markup: string
  status: "Active" | "Inactive"
}

export type MobileRate = {
  id: string
  name: string
  discount: string
  status: "Active" | "Draft"
  bookings: number
  roomTypes: string
  platform: string
  minStay: string
}

export type ValueAdd = {
  id: string
  name: string
  category: string
  description: string
  price: string
  status: "Active" | "Inactive"
}

export type SourceMarket = { country: string; share: number }

export type DemandCity = {
  id: string
  city: string
  monthlySearches: number
  yourBookings: number
  marketAvgRate: number
  sources: SourceMarket[]
}

export type PaceCompleted = {
  period: string
  bookings: number
  revenue: number
  adr: number
  occupancy: number
}

export type PaceFuture = {
  period: string
  bookedNow: number
  lastYear: number
}

export type BookerSegment = {
  segment: string
  bookings: number
  share: number
  avgSpend: number
  avgStay: number
  topSource: string
}

export type BookWindowRow = {
  window: string
  bookings: number
  share: number
  avgRate: number
  cancelRate: number
}

export type CancellationReason = {
  reason: string
  count: number
  share: number
  avgDaysBefore: number
  typicalRefund: string
}

export type ComparableProperty = {
  property: string
  yourAdr: number
  marketAdr: number
  yourOcc: number
  marketOcc: number
  yourScore: number
  marketScore: number
}

export type RankingRow = {
  rank: number
  property: string
  city: string
  score: number
  reviews: number
  conversion: number
  trend: Trend
}

export type PerformanceRow = {
  property: string
  revenue: number
  bookings: number
  adr: number
  occupancy: number
  revpar: number
  score: number
}

export type Contact = {
  id: string
  name: string
  email: string
  phone: string
  role: string
  property: string
  seed: string
}

export type Device = {
  id: string
  name: string
  browser: string
  location: string
  lastActive: string
  current: boolean
  type: "laptop" | "phone" | "tablet" | "desktop"
}

export type Contract = {
  id: string
  name: string
  type: string
  status: "Active"
  signed: string
  expires: string
  body: string
}

export type Compliance = {
  id: string
  name: string
  status: "Compliant" | "In Progress"
  lastReviewed: string
  description: string
}

export type PromotionTemplate = {
  id: string
  name: string
  discount: string
  type: string
  minStay: string
  bookingWindow: string
  validity: string
  status: "Available" | "Draft"
  uses: number
}

export type GeniusTier = {
  id: string
  level: string
  discount: string
  current: boolean
  features: string[]
}

export type PreferredCriterion = {
  id: string
  label: string
  required: string
  yours: string
  met: boolean
}

export type LongStayModule = {
  id: string
  name: string
  description: string
  status: "Active" | "Available"
  icon: string
}

export type RoomDifferentiation = {
  id: string
  roomType: string
  marketStandard: string
  yourOffering: string
  advantage: string
}

export type SupportTicket = {
  id: string
  subject: string
  guest: string
  category: string
  priority: "Low" | "Medium" | "High"
  status: "Open" | "Resolved"
  updated: string
  preview: string
  seed: string
}

export type GuestComm = {
  id: string
  guest: string
  stayStatus: "Pre-Arrival" | "In-Stay" | "Post-Stay"
  message: string
  property: string
  room: string
  channel: string
  time: string
  messages: number
  seed: string
}

export type ScoreCategory = {
  id: string
  name: string
  score: number
  status: string
  tip: string
}

export type ReservationPolicy = {
  id: string
  title: string
  value: string
  detail: string
  icon: string
}

/** Delivery channels for a notification preference. */
export type MessagingChannel = "email" | "sms" | "push"

/** A row in the Messaging Preferences matrix — one notification type, toggled per channel. */
export type MessagingPreference = {
  id: string
  label: string
  description: string
  channels: Record<MessagingChannel, boolean>
}
