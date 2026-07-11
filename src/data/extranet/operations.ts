import type { Opportunity, Promotion, RatePlan } from "@/lib/extranet/types"

/** Rate Plans — 8 plans, 7 active. */
export const ratePlans: RatePlan[] = [
  {
    id: "rp1",
    name: "Standard Flexible Rate",
    price: 189,
    cancellation: "Free cancellation up to 24h",
    inclusion: "Room only",
    roomTypes: 6,
    status: "Active",
  },
  {
    id: "rp2",
    name: "Non-Refundable Saver",
    price: 152,
    cancellation: "Non-refundable",
    inclusion: "Room only",
    roomTypes: 5,
    status: "Active",
  },
  {
    id: "rp3",
    name: "Bed & Breakfast",
    price: 215,
    cancellation: "Free cancellation up to 48h",
    inclusion: "Breakfast included",
    roomTypes: 6,
    status: "Active",
  },
  {
    id: "rp4",
    name: "Half Board Package",
    price: 289,
    cancellation: "Free cancellation up to 48h",
    inclusion: "Breakfast & dinner",
    roomTypes: 4,
    status: "Active",
  },
  {
    id: "rp5",
    name: "Romance Package",
    price: 350,
    cancellation: "Free cancellation up to 72h",
    inclusion: "Breakfast, champagne & spa",
    roomTypes: 3,
    status: "Draft",
  },
  {
    id: "rp6",
    name: "Early Bird Discount",
    price: 145,
    cancellation: "Non-refundable",
    inclusion: "Room only · book 30+ days ahead",
    roomTypes: 5,
    status: "Active",
  },
  {
    id: "rp7",
    name: "Last Minute Deal",
    price: 120,
    cancellation: "Non-refundable",
    inclusion: "Room only · within 3 days",
    roomTypes: 4,
    status: "Active",
  },
  {
    id: "rp8",
    name: "Corporate Rate",
    price: 170,
    cancellation: "Free cancellation up to 24h",
    inclusion: "Breakfast & WiFi",
    roomTypes: 6,
    status: "Active",
  },
]

/** Active Promotions — 6 promotions, 5 active. */
export const promotions: Promotion[] = [
  {
    id: "PROMO-001",
    name: "Early Bird 2026",
    discount: "20% off",
    period: "Jan 1 – Mar 31, 2026",
    roomTypes: "All rooms",
    bookings: 312,
    revenue: 52840,
    status: "Active",
  },
  {
    id: "PROMO-002",
    name: "Summer Getaway",
    discount: "$50 off",
    period: "Jun 1 – Aug 31, 2026",
    roomTypes: "Suites",
    bookings: 198,
    revenue: 41260,
    status: "Active",
  },
  {
    id: "PROMO-003",
    name: "Last Minute Escape",
    discount: "35% off",
    period: "Rolling · within 3 days",
    roomTypes: "Standard, Premium",
    bookings: 145,
    revenue: 18540,
    status: "Active",
  },
  {
    id: "PROMO-004",
    name: "Weekend Special",
    discount: "3rd night free",
    period: "Fri – Sun",
    roomTypes: "All rooms",
    bookings: 0,
    revenue: 0,
    status: "Paused",
  },
  {
    id: "PROMO-005",
    name: "Loyalty Member Rate",
    discount: "10% off",
    period: "Year-round",
    roomTypes: "All rooms",
    bookings: 523,
    revenue: 88910,
    status: "Active",
  },
  {
    id: "PROMO-006",
    name: "Stay Longer, Save More",
    discount: "15% off",
    period: "Stays of 5+ nights",
    roomTypes: "All rooms",
    bookings: 147,
    revenue: 37443,
    status: "Active",
  },
]

export const promotionStats = {
  totalRevenue: promotions.reduce((sum, p) => sum + p.revenue, 0),
  totalBookings: promotions.reduce((sum, p) => sum + p.bookings, 0),
  avgDiscount: "18.5%",
  active: promotions.filter((p) => p.status === "Active").length,
}

/** Opportunity Center — 4 opportunities to boost performance. */
export const opportunities: Opportunity[] = [
  {
    id: "op1",
    title: "Add photos of your restaurant",
    description:
      "Properties with dining photos get 18% more bookings. Grand Horizon has no restaurant images yet.",
    impact: "High",
    cta: "Add photos",
    icon: "Camera",
  },
  {
    id: "op2",
    title: "Enable Instant Booking",
    description:
      "Let guests book without manual confirmation. Instant Booking properties rank higher in search.",
    impact: "High",
    cta: "Enable now",
    icon: "Zap",
  },
  {
    id: "op3",
    title: "Add a Last-Minute Discount",
    description:
      "Fill 14 unsold room-nights this week with a targeted last-minute promotion.",
    impact: "Medium",
    cta: "Create discount",
    icon: "Tag",
  },
  {
    id: "op4",
    title: "Respond to 4 pending reviews",
    description:
      "Responding within 48 hours improves your review score and guest trust.",
    impact: "Medium",
    cta: "Respond",
    icon: "MessageSquare",
  },
]
