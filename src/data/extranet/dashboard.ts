import type {
  CheckIn,
  PendingAction,
  SeriesPoint,
  SourceSlice,
  Stat,
  Tip,
} from "@/lib/extranet/types"

export const dashboardDate = "Wednesday, June 17, 2026"

/** Eight headline KPI tiles. */
export const dashboardStats: Stat[] = [
  {
    label: "Today's Bookings",
    value: "52",
    delta: "+14.3%",
    trend: "up",
    caption: "vs yesterday",
    icon: "CalendarCheck",
  },
  {
    label: "Today's Revenue",
    value: "$17,122",
    delta: "+9.5%",
    trend: "up",
    caption: "vs yesterday",
    icon: "DollarSign",
  },
  {
    label: "Occupancy Rate",
    value: "72%",
    delta: "+1.8%",
    trend: "up",
    caption: "vs last week",
    icon: "BedDouble",
  },
  {
    label: "Arrivals Today",
    value: "42",
    delta: "+6%",
    trend: "up",
    caption: "vs yesterday",
    icon: "LogIn",
  },
  {
    label: "Departures Today",
    value: "36",
    delta: "-2%",
    trend: "down",
    caption: "vs yesterday",
    icon: "LogOut",
  },
  {
    label: "Pending Reviews",
    value: "25",
    delta: "+15%",
    trend: "up",
    caption: "vs last week",
    icon: "Star",
  },
  {
    label: "Avg. Daily Rate",
    value: "$329.27",
    delta: "+3.6%",
    trend: "up",
    caption: "vs last month",
    icon: "TrendingUp",
  },
  {
    label: "RevPAR",
    value: "$237.15",
    delta: "+3.2%",
    trend: "up",
    caption: "vs last month",
    icon: "BarChart3",
  },
]

/** Revenue Overview — six months, revenue ($) + bookings count. */
export const revenueSeries: SeriesPoint[] = [
  { label: "Jan", value: 78400, secondary: 248 },
  { label: "Feb", value: 92100, secondary: 286 },
  { label: "Mar", value: 86700, secondary: 271 },
  { label: "Apr", value: 110300, secondary: 322 },
  { label: "May", value: 124800, secondary: 358 },
  { label: "Jun", value: 129400, secondary: 372 },
]

/** Booking Sources — donut. Direct is the highest source (5 sources). */
export const bookingSources: SourceSlice[] = [
  { label: "Direct", value: 35 },
  { label: "Booking.com", value: 28 },
  { label: "Expedia", value: 18 },
  { label: "Travel Agency", value: 12 },
  { label: "Other", value: 7 },
]

/** Weekly Occupancy — Mon … Sun. */
export const weeklyOccupancy: SeriesPoint[] = [
  { label: "Mon", value: 68 },
  { label: "Tue", value: 72 },
  { label: "Wed", value: 70 },
  { label: "Thu", value: 74 },
  { label: "Fri", value: 82 },
  { label: "Sat", value: 88 },
  { label: "Sun", value: 76 },
]

export const upcomingCheckIns: CheckIn[] = [
  { guest: "Mateo Silva", roomNo: "312", room: "Deluxe Ocean Suite", inDays: 1 },
  { guest: "Isabella Rossi", roomNo: "201", room: "Premium King", inDays: 2 },
  { guest: "Ethan Park", roomNo: "115", room: "Standard Room", inDays: 3 },
  { guest: "Charlotte Dubois", roomNo: "405", room: "Family Suite", inDays: 4 },
]

export const pendingActions: PendingAction[] = [
  {
    id: "pa1",
    title: "2 reservations require check-in confirmation",
    meta: "Due today",
    icon: "CalendarClock",
  },
  {
    id: "pa2",
    title: "3 guest reviews need a response",
    meta: "Respond within 48h",
    icon: "MessageSquare",
  },
  {
    id: "pa3",
    title: "Rate update for next month is pending",
    meta: "Submitted 2 days ago",
    icon: "Tag",
  },
  {
    id: "pa4",
    title: "Invoice #INV-2026-0612 is due",
    meta: "Due in 5 days",
    icon: "FileText",
  },
  {
    id: "pa5",
    title: "Room 408 maintenance scheduled for tomorrow",
    meta: "Tomorrow, 10:00 AM",
    icon: "Wrench",
  },
]

export const tips: Tip[] = [
  {
    id: "t1",
    title: "Your property is running out of long-term availability",
    cta: "Add availability",
    icon: "CalendarPlus",
  },
  {
    id: "t2",
    title: "Add pet costs in your rate plans",
    cta: "Add pet costs",
    icon: "DollarSign",
  },
  {
    id: "t3",
    title: "Update your property photos",
    cta: "Update photos",
    icon: "Camera",
  },
  {
    id: "t4",
    title: "Enable mobile rates for more bookings",
    cta: "Enable mobile rates",
    icon: "Smartphone",
  },
]
