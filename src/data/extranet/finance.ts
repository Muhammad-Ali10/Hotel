import type { RevenueRow, SeriesPoint, Stat } from "@/lib/extranet/types"

/** Finance KPI tiles. */
export const financeStats: Stat[] = [
  { label: "Total Revenue YTD", value: "$4,282,400", delta: "+18.2%", trend: "up" },
  { label: "Net Revenue YTD", value: "$3,753,488", delta: "+16.8%", trend: "up" },
  { label: "Commissions Paid", value: "$528,912", delta: "+22.4%", trend: "up" },
  { label: "Pending Payouts", value: "$342,880", delta: "-8.3%", trend: "down" },
  {
    label: "Outstanding Invoices",
    value: "$184,320",
    delta: "+5.2%",
    trend: "up",
  },
  {
    label: "Avg. Commission Rate",
    value: "12.4%",
    delta: "+0.2pp",
    trend: "up",
  },
]

/** Revenue by property (YTD). Revenue column sums to $4,282,400. */
export const revenueByProperty: RevenueRow[] = [
  {
    property: "Grand Horizon",
    city: "Malibu, CA",
    revenue: 1284720,
    bookings: 4312,
    adr: 298,
    revpar: 232,
    occupancy: 78,
    growth: 18,
  },
  {
    property: "The Metropolitan",
    city: "Chicago, IL",
    revenue: 1156248,
    bookings: 2138,
    adr: 541,
    revpar: 460,
    occupancy: 85,
    growth: 14,
  },
  {
    property: "Alpine Lodge Zermatt",
    city: "Zermatt",
    revenue: 742180,
    bookings: 1284,
    adr: 541,
    revpar: 335,
    occupancy: 62,
    growth: 9,
  },
  {
    property: "Casa del Mar",
    city: "Tulum",
    revenue: 486920,
    bookings: 2570,
    adr: 189.5,
    revpar: 110,
    occupancy: 58,
    growth: 24,
  },
  {
    property: "Sakura Ryokan",
    city: "Kyoto",
    revenue: 612332,
    bookings: 1730,
    adr: 354,
    revpar: 251,
    occupancy: 71,
    growth: 16,
  },
]

/** Analytics KPI tiles (last 12 months). */
export const analyticsStats: Stat[] = [
  { label: "Total Revenue", value: "$847,290", delta: "+12.4%", trend: "up" },
  { label: "Occupancy Rate", value: "74.6%", delta: "+3.2%", trend: "up" },
  { label: "Avg. Daily Rate", value: "$218", delta: "+5.7%", trend: "up" },
  { label: "RevPAR", value: "$162.60", delta: "+9.1%", trend: "up" },
  { label: "Total Bookings", value: "3,842", delta: "+16.8%", trend: "up" },
  { label: "Conversion Rate", value: "8.2%", delta: "+1.1pp", trend: "up" },
]

export const analyticsInsights = [
  {
    title: "Booking.com drives 42% of bookings",
    description:
      "Up from 38% last quarter — continue investing in this channel",
    icon: "Globe",
  },
  {
    title: "Mobile bookings now 58% of total",
    description:
      "Your mobile rates program is working. Consider expanding mobile-only offers.",
    icon: "Smartphone",
  },
  {
    title: "Weekday occupancy dropped to 52%",
    description: "Consider a weekday business traveler rate to fill the gap",
    icon: "CalendarRange",
  },
  {
    title: "Guest review score improved to 8.4",
    description: "Response rate of 95% is contributing to higher scores",
    icon: "Star",
  },
]

/** 12-month revenue trend for the analytics page ($). */
export const analyticsMonthly: SeriesPoint[] = [
  { label: "Jul", value: 58200 },
  { label: "Aug", value: 62400 },
  { label: "Sep", value: 66100 },
  { label: "Oct", value: 70300 },
  { label: "Nov", value: 63800 },
  { label: "Dec", value: 78600 },
  { label: "Jan", value: 68200 },
  { label: "Feb", value: 72500 },
  { label: "Mar", value: 70900 },
  { label: "Apr", value: 75400 },
  { label: "May", value: 80700 },
  { label: "Jun", value: 84300 },
]
