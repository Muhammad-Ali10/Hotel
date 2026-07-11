import type {
  BookerSegment,
  BookWindowRow,
  CancellationReason,
  ComparableProperty,
  DemandCity,
  PaceCompleted,
  PaceFuture,
  PerformanceRow,
  RankingRow,
  SeriesPoint,
  Stat,
} from "@/lib/extranet/types"

/* --------------------------- Demand for City --------------------------- */

export const demandCities: DemandCity[] = [
  {
    id: "new-york",
    city: "New York",
    monthlySearches: 28500,
    yourBookings: 1240,
    marketAvgRate: 410,
    sources: [
      { country: "United States", share: 35 },
      { country: "Canada", share: 18 },
      { country: "United Kingdom", share: 14 },
      { country: "Germany", share: 10 },
      { country: "Brazil", share: 8 },
    ],
  },
  {
    id: "tokyo",
    city: "Tokyo",
    monthlySearches: 22100,
    yourBookings: 980,
    marketAvgRate: 295,
    sources: [
      { country: "Japan", share: 30 },
      { country: "China", share: 20 },
      { country: "United States", share: 15 },
      { country: "South Korea", share: 12 },
      { country: "Australia", share: 9 },
    ],
  },
  {
    id: "zermatt",
    city: "Zermatt",
    monthlySearches: 12300,
    yourBookings: 720,
    marketAvgRate: 380,
    sources: [
      { country: "Switzerland", share: 25 },
      { country: "Germany", share: 22 },
      { country: "United Kingdom", share: 15 },
      { country: "France", share: 12 },
      { country: "Italy", share: 8 },
    ],
  },
  {
    id: "marbella",
    city: "Marbella",
    monthlySearches: 16800,
    yourBookings: 860,
    marketAvgRate: 265,
    sources: [
      { country: "Spain", share: 28 },
      { country: "United Kingdom", share: 22 },
      { country: "Germany", share: 16 },
      { country: "France", share: 10 },
      { country: "Netherlands", share: 7 },
    ],
  },
  {
    id: "kyoto",
    city: "Kyoto",
    monthlySearches: 19400,
    yourBookings: 910,
    marketAvgRate: 320,
    sources: [
      { country: "Japan", share: 32 },
      { country: "China", share: 18 },
      { country: "United States", share: 14 },
      { country: "Australia", share: 11 },
      { country: "Taiwan", share: 8 },
    ],
  },
]

/* --------------------------- Pace of Bookings -------------------------- */

export const paceCompleted: PaceCompleted[] = [
  { period: "Jan 2026", bookings: 248, revenue: 78400, adr: 316, occupancy: 64 },
  { period: "Feb 2026", bookings: 286, revenue: 92100, adr: 322, occupancy: 68 },
  { period: "Mar 2026", bookings: 271, revenue: 86700, adr: 320, occupancy: 66 },
  { period: "Apr 2026", bookings: 322, revenue: 110300, adr: 343, occupancy: 74 },
  { period: "May 2026", bookings: 358, revenue: 124800, adr: 349, occupancy: 82 },
  { period: "Jun 2026", bookings: 372, revenue: 129400, adr: 348, occupancy: 78 },
]

export const paceFuture: PaceFuture[] = [
  { period: "Jul 2026", bookedNow: 210, lastYear: 185 },
  { period: "Aug 2026", bookedNow: 195, lastYear: 178 },
  { period: "Sep 2026", bookedNow: 142, lastYear: 156 },
  { period: "Oct 2026", bookedNow: 120, lastYear: 110 },
  { period: "Nov 2026", bookedNow: 88, lastYear: 95 },
  { period: "Dec 2026", bookedNow: 134, lastYear: 118 },
]

/* --------------------------- Sales Statistics -------------------------- */

export const salesStats: Stat[] = [
  { label: "Gross Booking Value", value: "$1,247,390", delta: "+15.2%", trend: "up" },
  { label: "Net Revenue", value: "$847,290", delta: "+12.4%", trend: "up" },
  { label: "Avg. Booking Value", value: "$324", delta: "+3.1%", trend: "up" },
  { label: "Commission Paid", value: "$187,108", delta: "+14.8%", trend: "up" },
  { label: "Avg. Stay Length", value: "3.2 nights", delta: "+0.2", trend: "up" },
  { label: "RevPAR", value: "$162.60", delta: "+9.1%", trend: "up" },
]

export const salesTrend: SeriesPoint[] = [
  { label: "Jan", value: 21400 },
  { label: "Feb", value: 24800 },
  { label: "Mar", value: 22900 },
  { label: "Apr", value: 29200 },
  { label: "May", value: 32600 },
  { label: "Jun", value: 35100 },
]

/* ---------------------------- Booker Insights -------------------------- */

export const bookerSegments: BookerSegment[] = [
  { segment: "Leisure Couples", bookings: 1240, share: 32, avgSpend: 1180, avgStay: 3.4, topSource: "Direct" },
  { segment: "Business Travelers", bookings: 980, share: 26, avgSpend: 890, avgStay: 2.1, topSource: "Booking.com" },
  { segment: "Families", bookings: 620, share: 16, avgSpend: 2150, avgStay: 4.2, topSource: "Direct" },
  { segment: "Solo Travelers", bookings: 410, share: 11, avgSpend: 640, avgStay: 1.8, topSource: "Expedia" },
  { segment: "Groups", bookings: 320, share: 8, avgSpend: 3480, avgStay: 2.9, topSource: "Travel Agency" },
  { segment: "Luxury Seekers", bookings: 272, share: 7, avgSpend: 4920, avgStay: 4.6, topSource: "Direct" },
]

/* ----------------------------- Book Window ----------------------------- */

export const bookWindowRows: BookWindowRow[] = [
  { window: "Same day", bookings: 180, share: 5, avgRate: 342, cancelRate: 2.1 },
  { window: "1–3 days", bookings: 420, share: 11, avgRate: 328, cancelRate: 3.4 },
  { window: "4–7 days", bookings: 610, share: 16, avgRate: 315, cancelRate: 4.2 },
  { window: "1–2 weeks", bookings: 740, share: 19, avgRate: 308, cancelRate: 5.1 },
  { window: "2–4 weeks", bookings: 820, share: 21, avgRate: 298, cancelRate: 6.8 },
  { window: "1–3 months", bookings: 690, share: 18, avgRate: 312, cancelRate: 8.4 },
  { window: "3+ months", bookings: 382, share: 10, avgRate: 335, cancelRate: 11.2 },
]

/* --------------------- Cancellation Characteristics -------------------- */

export const cancellationCharStats: Stat[] = [
  { label: "Total Cancellations", value: "150" },
  { label: "Cancellation Rate", value: "3.9%" },
  { label: "Avg. Days Before", value: "5.4 days" },
  { label: "Lost Revenue", value: "$42,310" },
]

export const cancellationReasons: CancellationReason[] = [
  { reason: "Travel plans changed", count: 42, share: 28, avgDaysBefore: 6.2, typicalRefund: "Full" },
  { reason: "Personal emergency", count: 28, share: 19, avgDaysBefore: 8.1, typicalRefund: "Partial" },
  { reason: "Found better rate elsewhere", count: 22, share: 15, avgDaysBefore: 3.4, typicalRefund: "Full" },
  { reason: "Weather concerns", count: 18, share: 12, avgDaysBefore: 2.1, typicalRefund: "Full" },
  { reason: "Visa / travel document issue", count: 14, share: 9, avgDaysBefore: 4.8, typicalRefund: "Full" },
  { reason: "Flight cancelled", count: 12, share: 8, avgDaysBefore: 5.6, typicalRefund: "Partial" },
  { reason: "Property-initiated", count: 8, share: 5, avgDaysBefore: 1.9, typicalRefund: "Full" },
  { reason: "Other", count: 6, share: 4, avgDaysBefore: 7.2, typicalRefund: "No Refund" },
]

/* -------------------------- Comparable Properties ---------------------- */

export const comparableProperties: ComparableProperty[] = [
  { property: "Grand Horizon", yourAdr: 298, marketAdr: 310, yourOcc: 78, marketOcc: 72, yourScore: 8.6, marketScore: 8.3 },
  { property: "The Metropolitan", yourAdr: 541, marketAdr: 520, yourOcc: 85, marketOcc: 80, yourScore: 8.9, marketScore: 8.5 },
  { property: "Alpine Lodge Zermatt", yourAdr: 541, marketAdr: 560, yourOcc: 62, marketOcc: 65, yourScore: 8.4, marketScore: 8.6 },
  { property: "Casa del Mar", yourAdr: 189.5, marketAdr: 175, yourOcc: 58, marketOcc: 60, yourScore: 8.2, marketScore: 8.0 },
  { property: "Sakura Ryokan", yourAdr: 354, marketAdr: 340, yourOcc: 71, marketOcc: 68, yourScore: 9.1, marketScore: 8.7 },
]

/* ------------------------------ Genius Report -------------------------- */

export const geniusStats: Stat[] = [
  { label: "Genius Bookings", value: "1,245", caption: "32% of total" },
  { label: "Genius Revenue", value: "$281,430", caption: "33% of total" },
  { label: "Genius ADR", value: "$226", caption: "+$8 vs non-Genius" },
  { label: "Genius Guests", value: "890", caption: "Repeat rate: 42%" },
]

export const geniusImpact = [
  { label: "Genius bookings as % of total", value: "32%" },
  { label: "Average discount offered", value: "10%" },
  { label: "Incremental revenue from Genius", value: "+$48,200" },
]

/* ----------------------------- Ranking --------------------------------- */

export const rankingRows: RankingRow[] = [
  { rank: 3, property: "Grand Horizon", city: "Malibu, CA", score: 8.6, reviews: 1240, conversion: 8.2, trend: "up" },
  { rank: 2, property: "The Metropolitan", city: "Chicago, IL", score: 8.9, reviews: 980, conversion: 9.1, trend: "up" },
  { rank: 5, property: "Alpine Lodge Zermatt", city: "Zermatt", score: 8.4, reviews: 620, conversion: 6.8, trend: "down" },
  { rank: 4, property: "Casa del Mar", city: "Tulum", score: 8.2, reviews: 410, conversion: 7.4, trend: "flat" },
  { rank: 1, property: "Sakura Ryokan", city: "Kyoto", score: 9.1, reviews: 890, conversion: 10.2, trend: "up" },
]

/* ----------------------------- Performance ----------------------------- */

export const performanceRows: PerformanceRow[] = [
  { property: "Grand Horizon", revenue: 1284720, bookings: 4312, adr: 298, occupancy: 78, revpar: 232, score: 8.6 },
  { property: "The Metropolitan", revenue: 1156248, bookings: 2138, adr: 541, occupancy: 85, revpar: 460, score: 8.9 },
  { property: "Alpine Lodge Zermatt", revenue: 742180, bookings: 1284, adr: 541, occupancy: 62, revpar: 335, score: 8.4 },
  { property: "Casa del Mar", revenue: 486920, bookings: 2570, adr: 189.5, occupancy: 58, revpar: 110, score: 8.2 },
  { property: "Sakura Ryokan", revenue: 612332, bookings: 1730, adr: 354, occupancy: 71, revpar: 251, score: 9.1 },
]
