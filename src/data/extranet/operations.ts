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
/** Opportunity Center — 4 opportunities to boost performance. */
export const opportunities: Opportunity[] = [
  {
    id: "op1",
    title: "Add photos of your restaurant",
    description:
      "Properties with dining photos get 18% more bookings. The Ritz-Carlton has no restaurant images yet.",
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
