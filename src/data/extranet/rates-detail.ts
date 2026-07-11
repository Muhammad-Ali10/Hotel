import type {
  AvailabilityDay,
  CalendarBooking,
  CountryRate,
  MobileRate,
  OpenCloseRoom,
  PricingRow,
  RestrictionRule,
  ValueAdd,
} from "@/lib/extranet/types"

/* ------------------------------- Calendar ------------------------------ */

export const calendarMonthLabel = "June 2026"
export const calendarYear = 2026
export const calendarMonthIndex = 5 // June (0-based)

const calRooms = [
  "Deluxe Ocean Suite",
  "Premium King",
  "Penthouse Suite",
  "Standard Room",
  "Family Suite",
  "Accessible Room",
]

const calGuests = [
  "Emma Richardson", "James Chen", "Sofia Martinez", "Liam O'Brien",
  "Yuki Tanaka", "Charlotte Dubois", "Mateo Silva", "Isabella Rossi",
  "Ethan Park", "Camille Lefevre", "Noah Williams", "Hannah Schmidt",
  "Lucas Moreau", "Mia Anderson", "Oliver Brown", "Daniel Kim", "Grace Lee",
  "Ahmed Hassan", "Emily Davis", "Thomas Müller", "Laura Bianchi",
  "Kevin Wright", "Nina Petrova", "Marco Rossi", "Sophie Turner",
  "David Chen", "Maria Lopez", "Hans Mueller", "Ava Thompson",
  "Olivia Williams", "Ryan Cooper", "Chloe Bennett", "Felix Wagner",
]

const dayPattern = [
  2, 3, 3, 5, 6, 8, 9, 9, 10, 11, 12, 12, 14, 15, 16, 17, 17, 18, 19, 20, 22,
  23, 23, 24, 25, 26, 27, 28, 29, 30, 6, 17, 23,
]

export const calendarBookings: CalendarBooking[] = calGuests.map((guest, i) => ({
  id: `cb${i + 1}`,
  day: dayPattern[i],
  guest,
  room: calRooms[i % calRooms.length],
}))

export const roomLegend = calRooms.map((room) => ({
  room,
  count: calendarBookings.filter((b) => b.room === room).length,
}))

export const calendarStats = {
  total: calendarBookings.length,
  uniqueGuests: new Set(calendarBookings.map((b) => b.guest)).size,
}

export const upcomingArrivals = [...calendarBookings]
  .sort((a, b) => a.day - b.day)
  .slice(0, 8)

/* --------------------------- Availability ------------------------------ */

const availabilityPct = [
  80, 72, 65, 90, 55, 40, 25, 60, 75, 85, 50, 45, 30, 70, 88, 92, 58, 42, 35,
  68, 78, 95, 52, 48, 28, 62, 82, 90, 55, 38,
]

export const availabilityDays: AvailabilityDay[] = availabilityPct.map((pct, i) => {
  const d = new Date(2026, 5, 15 + i)
  const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`
  return {
    date,
    label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    availability: pct,
  }
})

/* --------------------------- Open / Close ------------------------------ */

export const openCloseRooms: OpenCloseRoom[] = [
  { id: "oc1", roomType: "Deluxe Ocean Suite", open: 8, closed: 2, upcomingClosure: "—" },
  { id: "oc2", roomType: "Penthouse Suite", open: 2, closed: 1, upcomingClosure: "—" },
  { id: "oc3", roomType: "Premium King", open: 10, closed: 0, upcomingClosure: "Jul 15 (maintenance)" },
  { id: "oc4", roomType: "Family Suite", open: 8, closed: 0, upcomingClosure: "—" },
  { id: "oc5", roomType: "Standard Room", open: 12, closed: 0, upcomingClosure: "—" },
  { id: "oc6", roomType: "Accessible Room", open: 10, closed: 0, upcomingClosure: "Jul 20–22 (renovation)" },
]

/* ------------------------ Restriction Rules ---------------------------- */

export const restrictionRules: (RestrictionRule & { description: string })[] = [
  { id: "rr1", name: "Minimum Advance Booking", description: "Guests must book at least 24 hours before check-in", appliesTo: "All Room Types", value: "24 hours", status: "Active" },
  { id: "rr2", name: "Maximum Stay Length", description: "Maximum consecutive stay for Penthouse Suite", appliesTo: "Penthouse Suite", value: "14 nights", status: "Active" },
  { id: "rr3", name: "Minimum Stay — Weekend", description: "Minimum 2-night stay for Friday/Saturday arrivals", appliesTo: "Deluxe Ocean Suite, Premium King", value: "2 nights", status: "Active" },
  { id: "rr4", name: "Closed to Arrival", description: "No check-ins allowed on Sundays", appliesTo: "Standard Room", value: "Sundays", status: "Active" },
  { id: "rr5", name: "Maximum Guests", description: "Hard limit on maximum guests per booking", appliesTo: "Family Suite", value: "6 guests", status: "Active" },
  { id: "rr6", name: "Same Day Booking Cutoff", description: "No same-day bookings after 6 PM", appliesTo: "All Room Types", value: "6:00 PM", status: "Draft" },
]

/* --------------------------- Pricing Per Guest ------------------------- */

export const pricingColumns = [
  "Deluxe Ocean",
  "Penthouse",
  "Premium King",
  "Family Suite",
  "Standard",
  "Accessible",
]

export const pricingPerGuest: PricingRow[] = [
  { guests: 1, prices: [474, 1280, 349, 539, 189, 209] },
  { guests: 2, prices: [520, 1380, 389, 599, 219, 239] },
  { guests: 3, prices: [null, 1480, null, 659, null, null] },
  { guests: 4, prices: [null, 1580, null, 719, null, null] },
  { guests: 5, prices: [null, null, null, 779, null, null] },
  { guests: 6, prices: [null, null, null, 839, null, null] },
]

/* ----------------------------- Country Rates --------------------------- */

export const countryRates: CountryRate[] = [
  { id: "cr-us", country: "United States", code: "US", rate: "189 USD", markup: "Base rate", status: "Active" },
  { id: "cr-gb", country: "United Kingdom", code: "GB", rate: "152 GBP", markup: "+5%", status: "Active" },
  { id: "cr-de", country: "Germany", code: "DE", rate: "175 EUR", markup: "+3%", status: "Active" },
  { id: "cr-fr", country: "France", code: "FR", rate: "175 EUR", markup: "+3%", status: "Active" },
  { id: "cr-jp", country: "Japan", code: "JP", rate: "20,500 JPY", markup: "+8%", status: "Active" },
  { id: "cr-au", country: "Australia", code: "AU", rate: "285 AUD", markup: "+6%", status: "Active" },
  { id: "cr-ca", country: "Canada", code: "CA", rate: "245 CAD", markup: "+2%", status: "Active" },
  { id: "cr-cn", country: "China", code: "CN", rate: "1,350 CNY", markup: "+10%", status: "Active" },
  { id: "cr-br", country: "Brazil", code: "BR", rate: "940 BRL", markup: "+4%", status: "Active" },
  { id: "cr-in", country: "India", code: "IN", rate: "15,700 INR", markup: "Base rate", status: "Inactive" },
  { id: "cr-ae", country: "UAE", code: "AE", rate: "695 AED", markup: "+7%", status: "Active" },
  { id: "cr-kr", country: "South Korea", code: "KR", rate: "252,000 KRW", markup: "+5%", status: "Active" },
]

/* ----------------------------- Mobile Rates ---------------------------- */

export const mobileRates: MobileRate[] = [
  { id: "mr1", name: "Mobile-Only Flash Deal", discount: "25% off", status: "Active", bookings: 142, roomTypes: "All room types", platform: "iOS + Android", minStay: "1 night" },
  { id: "mr2", name: "App Exclusive Rate", discount: "15% off", status: "Active", bookings: 89, roomTypes: "Deluxe Ocean Suite, Premium King", platform: "iOS + Android", minStay: "2 nights" },
  { id: "mr3", name: "Last Minute Mobile", discount: "30% off", status: "Active", bookings: 216, roomTypes: "Standard Room, Accessible Room", platform: "iOS + Android", minStay: "1 night" },
  { id: "mr4", name: "Weekend Mobile Saver", discount: "20% off", status: "Draft", bookings: 0, roomTypes: "All room types", platform: "iOS + Android", minStay: "2 nights" },
  { id: "mr5", name: "Push Notification Offer", discount: "35% off", status: "Active", bookings: 34, roomTypes: "Penthouse Suite", platform: "iOS only", minStay: "1 night" },
]

/* ------------------------------ Value Adds ----------------------------- */

export const valueAdds: ValueAdd[] = [
  { id: "va1", name: "Airport Transfer", category: "Transportation", description: "Private transfer to and from the airport.", price: "$65", status: "Active" },
  { id: "va2", name: "Early Check-in", category: "Convenience", description: "Check in from 12:00 PM, subject to availability.", price: "$35", status: "Active" },
  { id: "va3", name: "Late Check-out", category: "Convenience", description: "Check out until 3:00 PM, subject to availability.", price: "$45", status: "Active" },
  { id: "va4", name: "Champagne on Arrival", category: "Romance", description: "A chilled bottle of champagne in your room.", price: "$85", status: "Active" },
  { id: "va5", name: "Spa Treatment", category: "Wellness", description: "60-minute signature massage at our spa.", price: "$120/person", status: "Active" },
  { id: "va6", name: "Romantic Dinner Setup", category: "Romance", description: "Private candlelit dinner for two.", price: "$195", status: "Active" },
  { id: "va7", name: "Pet Welcome Kit", category: "Pets", description: "Bed, bowls and treats for your pet.", price: "$25", status: "Inactive" },
  { id: "va8", name: "Ski Equipment Rental", category: "Activities", description: "Full ski set rental, per day.", price: "$45/day", status: "Active" },
  { id: "va9", name: "Babysitting Service", category: "Family", description: "Certified in-room childcare.", price: "$30/hr", status: "Active" },
  { id: "va10", name: "Guided City Tour", category: "Activities", description: "Half-day guided tour with a local expert.", price: "$75/person", status: "Active" },
]

export const valueAddCategories = [
  "All",
  ...Array.from(new Set(valueAdds.map((v) => v.category))),
]
export const valueAddsActive = valueAdds.filter((v) => v.status === "Active").length
