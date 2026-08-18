import type {
  AnalyticsClientRow,
  DemandCity,
  DiscountTier,
  Promotion,
  RankingRow,
  SeriesPoint,
} from "@/lib/admin/types"
import { adminClients } from "./clients"
import { adminProperties, propertiesForClient, propertyById } from "./properties"
import { adminRevenueRows, revenueForClient } from "./finance"

/** Discount banding used for the promotion card ribbons. */
export function discountTier(discount: number): DiscountTier {
  if (discount >= 30) return "High Discount"
  if (discount >= 15) return "Moderate Discount"
  return "Low Discount"
}

/**
 * 14 campaigns — 8 Active, 2 Scheduled, 2 Paused, 2 Ended. Rebuilt on the
 * canonical international properties; the Figma's set was Pakistani hotels in
 * PKR, disjoint from every other screen.
 *
 * Active bookings sum to 321, matching the "Bookings Generated" stat tile.
 */
export const adminPromotions: Promotion[] = [
  {
    id: "PRM-001",
    name: "Summer Coastal Escape",
    kind: "Seasonal Deal",
    city: "Malibu",
    discount: 42,
    minStay: 2,
    propertyIds: ["HTL-1001"],
    travelWindow: "Jun 1 – Aug 31, 2026",
    status: "Active",
    bookings: 89,
    clientId: "CLI-001",
  },
  {
    id: "PRM-002",
    name: "City Break Flash",
    kind: "Limited Time",
    city: "Chicago",
    discount: 40,
    minStay: 3,
    propertyIds: ["HTL-1002"],
    travelWindow: "Jul 1 – Sep 30, 2026",
    status: "Active",
    bookings: 62,
    clientId: "CLI-002",
  },
  {
    id: "PRM-003",
    name: "Alpine Summer Retreat",
    kind: "Member Exclusive",
    city: "Zermatt",
    discount: 38,
    minStay: 2,
    propertyIds: ["HTL-1003"],
    travelWindow: "Ongoing",
    status: "Active",
    bookings: 47,
    clientId: "CLI-003",
  },
  {
    id: "PRM-004",
    name: "Riviera Weekender",
    kind: "Early Bird",
    city: "Brighton",
    discount: 33,
    minStay: 2,
    propertyIds: ["HTL-1006"],
    travelWindow: "Weekends only",
    status: "Active",
    bookings: 38,
    clientId: "CLI-002",
  },
  {
    id: "PRM-005",
    name: "Desert Nights",
    kind: "Group Booking",
    city: "Dubai",
    discount: 30,
    minStay: 3,
    propertyIds: ["HTL-1009"],
    travelWindow: "Oct 1 – Dec 31, 2026",
    status: "Active",
    bookings: 31,
    clientId: "CLI-005",
  },
  {
    id: "PRM-006",
    name: "Kyoto Cherry Season",
    kind: "Holiday Special",
    city: "Kyoto",
    discount: 24,
    minStay: 2,
    propertyIds: ["HTL-1005"],
    travelWindow: "Mar 20 – Apr 20, 2027",
    status: "Active",
    bookings: 24,
    clientId: "CLI-004",
  },
  {
    id: "PRM-007",
    name: "Manchester Midweek",
    kind: "Last Minute",
    city: "Manchester",
    discount: 18,
    minStay: 1,
    propertyIds: ["HTL-1008"],
    travelWindow: "Midweek special",
    status: "Active",
    bookings: 18,
    clientId: "CLI-002",
  },
  {
    id: "PRM-008",
    name: "Lakeside Getaway",
    kind: "Flash Sale",
    city: "Lucerne",
    discount: 12,
    minStay: 2,
    propertyIds: ["HTL-1012"],
    travelWindow: "Ongoing",
    status: "Active",
    bookings: 12,
    clientId: "CLI-003",
  },
  {
    id: "PRM-009",
    name: "Winter Peaks Preview",
    kind: "Early Bird",
    city: "St. Moritz",
    discount: 35,
    minStay: 3,
    propertyIds: ["HTL-1007"],
    travelWindow: "Dec 1, 2026 – Mar 31, 2027",
    status: "Scheduled",
    bookings: 0,
    clientId: "CLI-003",
  },
  {
    id: "PRM-010",
    name: "Tulum Green Season",
    kind: "Seasonal Deal",
    city: "Tulum",
    discount: 28,
    minStay: 2,
    propertyIds: ["HTL-1004"],
    travelWindow: "Sep 1 – Nov 30, 2026",
    status: "Scheduled",
    bookings: 0,
    clientId: "CLI-004",
  },
  {
    id: "PRM-011",
    name: "Pearl Launch Offer",
    kind: "Member Exclusive",
    city: "Santa Barbara",
    discount: 25,
    minStay: 2,
    propertyIds: ["HTL-1011"],
    travelWindow: "On property approval",
    status: "Paused",
    bookings: 0,
    clientId: "CLI-001",
  },
  {
    id: "PRM-012",
    name: "Tuscan Spring",
    kind: "Holiday Special",
    city: "Florence",
    discount: 20,
    minStay: 3,
    propertyIds: ["HTL-1010"],
    travelWindow: "Apr 1 – Jun 30, 2026",
    status: "Paused",
    bookings: 7,
    clientId: "CLI-006",
  },
  {
    id: "PRM-013",
    name: "Spring Awakening",
    kind: "Early Bird",
    city: "2 Cities",
    discount: 22,
    minStay: 2,
    propertyIds: ["HTL-1001", "HTL-1011"],
    travelWindow: "Mar 1 – May 31, 2026",
    status: "Ended",
    bookings: 54,
    clientId: "CLI-001",
  },
  {
    id: "PRM-014",
    name: "Golden Week Japan",
    kind: "Flash Sale",
    city: "Kyoto",
    discount: 15,
    minStay: 1,
    propertyIds: ["HTL-1005"],
    travelWindow: "Apr 29 – May 6, 2026",
    status: "Ended",
    bookings: 29,
    clientId: "CLI-004",
  },
]

/** Cities offered by the promotions city filter — derived, never hardcoded. */
export const promotionCities = Array.from(
  new Set(adminPromotions.map((p) => p.city).filter((c) => !c.includes("Cities")))
).sort()

export const activePromotionBookings = adminPromotions
  .filter((p) => p.status === "Active")
  .reduce((sum, p) => sum + p.bookings, 0)

/**
 * Discount rankings — one row per promoted property, ordered by discount.
 * Prices come from the property's ADR so the discounted figure is consistent.
 */
export const adminRankings: RankingRow[] = adminPromotions
  .filter((p) => p.status === "Active" || p.status === "Scheduled")
  .flatMap((p) =>
    p.propertyIds.map((propertyId) => ({ promotion: p, propertyId }))
  )
  .map(({ promotion, propertyId }) => {
    const property = propertyById(propertyId)
    const originalPrice = property?.adr ?? 0
    return {
      rank: 0,
      propertyId,
      rating: property ? property.stars - 0.3 + (property.occupancy % 5) / 10 : 0,
      discount: promotion.discount,
      discountedPrice: Math.round(originalPrice * (1 - promotion.discount / 100)),
      originalPrice,
    }
  })
  .sort((a, b) => b.discount - a.discount)
  .map((row, i) => ({ ...row, rank: i + 1 }))

/**
 * Per-client analytics. Property counts, revenue and bookings are all derived
 * from the canonical arrays, which is what reconciles the Figma's numbers
 * (its client rows claimed 18 properties while the master list showed 12).
 */
export const adminAnalyticsRows: AnalyticsClientRow[] = adminClients.map((c) => {
  const properties = propertiesForClient(c.id)
  const rows = adminRevenueRows.filter(
    (r) => propertyById(r.propertyId)?.clientId === c.id
  )
  const bookings = rows.reduce((sum, r) => sum + r.bookings, 0)
  const revenue = revenueForClient(c.id)
  const occupancy = properties.length
    ? properties.reduce((sum, p) => sum + p.occupancy, 0) / properties.length
    : 0
  const adr = bookings
    ? rows.reduce((sum, r) => sum + r.adr * r.bookings, 0) / bookings
    : 0
  const growth = rows.length
    ? rows.reduce((sum, r) => sum + r.growth, 0) / rows.length
    : 0

  return {
    clientId: c.id,
    properties: properties.length,
    revenue,
    bookings,
    occupancy: Math.round(occupancy * 10) / 10,
    adr: Math.round(adr),
    // Patched below from REVIEW_SCORES — editorial, not derivable.
    reviewScore: 0,
    growth: Math.round(growth * 10) / 10,
  }
})

/** Review scores are editorial, not derived — patch them onto the rows. */
const REVIEW_SCORES: Record<string, number> = {
  "CLI-001": 8.7,
  "CLI-002": 8.3,
  "CLI-003": 9.1,
  "CLI-004": 8.9,
  "CLI-005": 7.4,
  "CLI-006": 6.8,
}
for (const row of adminAnalyticsRows) {
  row.reviewScore = REVIEW_SCORES[row.clientId] ?? 0
}

export const adminDemandCities: DemandCity[] = [
  { id: "DMD-01", city: "Malibu", country: "United States", searchVolume: 485_000, growth: 22.5, avgRate: 389, occupancy: 78, properties: 1, level: "High", topNationality: "United States" },
  { id: "DMD-02", city: "Zermatt", country: "Switzerland", searchVolume: 285_000, growth: 31.2, avgRate: 520, occupancy: 62, properties: 1, level: "High", topNationality: "Germany" },
  { id: "DMD-03", city: "Chicago", country: "United States", searchVolume: 342_000, growth: 8.4, avgRate: 275, occupancy: 85, properties: 1, level: "Medium", topNationality: "United States" },
  { id: "DMD-04", city: "Tulum", country: "Mexico", searchVolume: 512_000, growth: 15.8, avgRate: 210, occupancy: 58, properties: 1, level: "High", topNationality: "United Kingdom" },
  { id: "DMD-05", city: "Kyoto", country: "Japan", searchVolume: 398_000, growth: 28.6, avgRate: 450, occupancy: 71, properties: 1, level: "High", topNationality: "China" },
  { id: "DMD-06", city: "Dubai", country: "UAE", searchVolume: 604_000, growth: 19.3, avgRate: 420, occupancy: 65, properties: 1, level: "High", topNationality: "India" },
  { id: "DMD-07", city: "Brighton", country: "United Kingdom", searchVolume: 176_000, growth: 6.2, avgRate: 290, occupancy: 80, properties: 1, level: "Medium", topNationality: "United Kingdom" },
  { id: "DMD-08", city: "Manchester", country: "United Kingdom", searchVolume: 231_000, growth: 4.1, avgRate: 165, occupancy: 90, properties: 1, level: "Medium", topNationality: "United Kingdom" },
  { id: "DMD-09", city: "St. Moritz", country: "Switzerland", searchVolume: 156_000, growth: 12.1, avgRate: 680, occupancy: 0, properties: 1, level: "Medium", topNationality: "Italy" },
  { id: "DMD-10", city: "Florence", country: "Italy", searchVolume: 289_000, growth: -3.4, avgRate: 310, occupancy: 27, properties: 1, level: "Low", topNationality: "United States" },
  { id: "DMD-11", city: "Lucerne", country: "Switzerland", searchVolume: 98_000, growth: 9.7, avgRate: 340, occupancy: 68, properties: 1, level: "Low", topNationality: "Germany" },
  { id: "DMD-12", city: "Santa Barbara", country: "United States", searchVolume: 143_000, growth: 11.5, avgRate: 425, occupancy: 0, properties: 1, level: "Low", topNationality: "United States" },
]

/** Six-month platform trend, used by the dashboard chart. */
export const dashboardSeries: SeriesPoint[] = [
  { label: "Feb", revenue: 620_000, bookings: 1_480 },
  { label: "Mar", revenue: 705_000, bookings: 1_620 },
  { label: "Apr", revenue: 780_000, bookings: 1_980 },
  { label: "May", revenue: 810_000, bookings: 2_240 },
  { label: "Jun", revenue: 835_000, bookings: 2_480 },
  { label: "Jul", revenue: 847_250, bookings: 2_680 },
]

/** Twelve-month view behind the chart's "1Y" toggle. */
export const dashboardSeriesYear: SeriesPoint[] = [
  { label: "Aug", revenue: 512_000, bookings: 1_090 },
  { label: "Sep", revenue: 548_000, bookings: 1_150 },
  { label: "Oct", revenue: 596_000, bookings: 1_240 },
  { label: "Nov", revenue: 542_000, bookings: 1_180 },
  { label: "Dec", revenue: 688_000, bookings: 1_420 },
  { label: "Jan", revenue: 574_000, bookings: 1_310 },
  ...dashboardSeries,
]

/** Seven-month analytics trend with occupancy, used on `/admin/analytics`. */
export const analyticsSeries: SeriesPoint[] = [
  { label: "Jan", revenue: 980_000, bookings: 1_480, occupancy: 52 },
  { label: "Feb", revenue: 1_050_000, bookings: 1_620, occupancy: 56 },
  { label: "Mar", revenue: 1_320_000, bookings: 1_980, occupancy: 63 },
  { label: "Apr", revenue: 1_580_000, bookings: 2_240, occupancy: 71 },
  { label: "May", revenue: 1_720_000, bookings: 2_480, occupancy: 76 },
  { label: "Jun", revenue: 1_890_000, bookings: 2_680, occupancy: 82 },
  { label: "Jul", revenue: 2_100_000, bookings: 2_920, occupancy: 88 },
]

export const totalPropertyCount = adminProperties.length
