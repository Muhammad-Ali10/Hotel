import type {
  CommissionReport,
  Invoice,
  Payout,
  SeriesPoint,
  SourceSlice,
  Transaction,
} from "@/lib/extranet/types"

/* ------------------------------- Revenue ------------------------------- */

export const revenueTrackingStats = {
  gross: 186100,
  commission: 22332,
  net: 163768,
}

/** Jan–Jun: net revenue (bars) + commission (line). */
export const revenueMonthly: SeriesPoint[] = [
  { label: "Jan", value: 24500, secondary: 3300 },
  { label: "Feb", value: 26200, secondary: 3550 },
  { label: "Mar", value: 25100, secondary: 3400 },
  { label: "Apr", value: 28600, secondary: 3870 },
  { label: "May", value: 29400, secondary: 3980 },
  { label: "Jun", value: 29968, secondary: 4232 },
]

/** Net revenue by property (horizontal bars). */
export const revenueByPropertyNet: SourceSlice[] = [
  { label: "Grand Horizon", value: 52800 },
  { label: "The Metropolitan", value: 41200 },
  { label: "Alpine Lodge Zermatt", value: 28600 },
  { label: "Sakura Ryokan", value: 25000 },
  { label: "Casa del Mar", value: 16168 },
]

/** 15 transactions (commission = 12% of amount). */
export const transactions: Transaction[] = [
  { id: "TXN-4021", date: "2026-06-15", guest: "Emma Richardson", property: "Grand Horizon", room: "Deluxe Ocean Suite", amount: 1422, commission: 171, net: 1251, channel: "Direct", status: "Completed" },
  { id: "TXN-4020", date: "2026-06-15", guest: "James Chen", property: "The Metropolitan", room: "Premium King", amount: 698, commission: 84, net: 614, channel: "Booking.com", status: "Completed" },
  { id: "TXN-4019", date: "2026-06-14", guest: "Liam O'Brien", property: "Grand Horizon", room: "Family Suite", amount: 2695, commission: 323, net: 2372, channel: "Direct", status: "Completed" },
  { id: "TXN-4018", date: "2026-06-14", guest: "Yuki Tanaka", property: "Sakura Ryokan", room: "Penthouse Suite", amount: 3840, commission: 461, net: 3379, channel: "Travel Agency", status: "Completed" },
  { id: "TXN-4017", date: "2026-06-13", guest: "Sofia Martinez", property: "Casa del Mar", room: "Standard Room", amount: 756, commission: 91, net: 665, channel: "Expedia", status: "Pending" },
  { id: "TXN-4016", date: "2026-06-13", guest: "Charlotte Dubois", property: "Grand Horizon", room: "Deluxe Ocean Suite", amount: 2370, commission: 284, net: 2086, channel: "Booking.com", status: "Completed" },
  { id: "TXN-4015", date: "2026-06-12", guest: "Mateo Silva", property: "The Metropolitan", room: "Premium King", amount: 1047, commission: 126, net: 921, channel: "Direct", status: "Completed" },
  { id: "TXN-4014", date: "2026-06-12", guest: "Isabella Rossi", property: "Casa del Mar", room: "Accessible Room", amount: 627, commission: 75, net: 552, channel: "Expedia", status: "Completed" },
  { id: "TXN-4013", date: "2026-06-11", guest: "Ethan Park", property: "Alpine Lodge Zermatt", room: "Standard Room", amount: 567, commission: 68, net: 499, channel: "Booking.com", status: "Refunded" },
  { id: "TXN-4012", date: "2026-06-11", guest: "Camille Lefevre", property: "Grand Horizon", room: "Family Suite", amount: 2695, commission: 323, net: 2372, channel: "Direct", status: "Completed" },
  { id: "TXN-4011", date: "2026-06-10", guest: "Noah Williams", property: "The Metropolitan", room: "Premium King", amount: 1047, commission: 126, net: 921, channel: "Travel Agency", status: "Completed" },
  { id: "TXN-4010", date: "2026-06-10", guest: "Hannah Schmidt", property: "Grand Horizon", room: "Deluxe Ocean Suite", amount: 1422, commission: 171, net: 1251, channel: "Booking.com", status: "Completed" },
  { id: "TXN-4009", date: "2026-06-09", guest: "Lucas Moreau", property: "Sakura Ryokan", room: "Penthouse Suite", amount: 3840, commission: 461, net: 3379, channel: "Direct", status: "Pending" },
  { id: "TXN-4008", date: "2026-06-09", guest: "Mia Anderson", property: "Casa del Mar", room: "Standard Room", amount: 756, commission: 91, net: 665, channel: "Expedia", status: "Completed" },
  { id: "TXN-4007", date: "2026-06-08", guest: "Oliver Brown", property: "Alpine Lodge Zermatt", room: "Accessible Room", amount: 627, commission: 75, net: 552, channel: "Booking.com", status: "Completed" },
]

/* ----------------------------- Commissions ----------------------------- */

/** 10 monthly commission reports (5 properties × Jun/May 2026), rate 12%. */
export const commissionReports: CommissionReport[] = [
  { id: "cr1", property: "Grand Horizon", month: "June 2026", status: "Pending", grossRevenue: 212000, rate: 12, commission: 25440, netToOwner: 186560, bookings: 72 },
  { id: "cr2", property: "Grand Horizon", month: "May 2026", status: "Paid", grossRevenue: 208000, rate: 12, commission: 24960, netToOwner: 183040, bookings: 68 },
  { id: "cr3", property: "The Metropolitan", month: "June 2026", status: "Pending", grossRevenue: 182000, rate: 12, commission: 21840, netToOwner: 160160, bookings: 58 },
  { id: "cr4", property: "The Metropolitan", month: "May 2026", status: "Paid", grossRevenue: 178000, rate: 12, commission: 21360, netToOwner: 156640, bookings: 55 },
  { id: "cr5", property: "Alpine Lodge Zermatt", month: "June 2026", status: "Pending", grossRevenue: 114000, rate: 12, commission: 13680, netToOwner: 100320, bookings: 32 },
  { id: "cr6", property: "Alpine Lodge Zermatt", month: "May 2026", status: "Paid", grossRevenue: 110000, rate: 12, commission: 13200, netToOwner: 96800, bookings: 30 },
  { id: "cr7", property: "Casa del Mar", month: "June 2026", status: "Pending", grossRevenue: 80000, rate: 12, commission: 9600, netToOwner: 70400, bookings: 26 },
  { id: "cr8", property: "Casa del Mar", month: "May 2026", status: "Paid", grossRevenue: 78800, rate: 12, commission: 9456, netToOwner: 69344, bookings: 24 },
  { id: "cr9", property: "Sakura Ryokan", month: "June 2026", status: "Pending", grossRevenue: 152000, rate: 12, commission: 18240, netToOwner: 133760, bookings: 27 },
  { id: "cr10", property: "Sakura Ryokan", month: "May 2026", status: "Paid", grossRevenue: 148000, rate: 12, commission: 17760, netToOwner: 130240, bookings: 23 },
]

export const commissionStats = {
  gross: commissionReports.reduce((s, r) => s + r.grossRevenue, 0),
  commission: commissionReports.reduce((s, r) => s + r.commission, 0),
  netToOwner: commissionReports.reduce((s, r) => s + r.netToOwner, 0),
  bookings: commissionReports.reduce((s, r) => s + r.bookings, 0),
}

/* ------------------------------- Payouts ------------------------------- */

export const payouts: Payout[] = [
  { id: "PYT-2041", date: "2026-06-01", property: "Grand Horizon", amount: 142000, method: "Bank Transfer", reference: "REF-90412", invoice: "STY-INV-0612", status: "Paid" },
  { id: "PYT-2040", date: "2026-06-01", property: "The Metropolitan", amount: 128500, method: "Bank Transfer", reference: "REF-90411", invoice: "STY-INV-0611", status: "Paid" },
  { id: "PYT-2039", date: "2026-06-01", property: "Sakura Ryokan", amount: 116428, method: "Wire", reference: "REF-90410", invoice: "STY-INV-0610", status: "Paid" },
  { id: "PYT-2038", date: "2026-05-01", property: "Grand Horizon", amount: 134000, method: "Bank Transfer", reference: "REF-90388", invoice: "STY-INV-0588", status: "Paid" },
  { id: "PYT-2037", date: "2026-05-01", property: "Alpine Lodge Zermatt", amount: 100000, method: "Wire", reference: "REF-90387", invoice: "STY-INV-0587", status: "Paid" },
  { id: "PYT-2036", date: "2026-06-15", property: "Grand Horizon", amount: 156000, method: "Bank Transfer", reference: "REF-90455", invoice: "STY-INV-0655", status: "Pending" },
  { id: "PYT-2035", date: "2026-06-15", property: "The Metropolitan", amount: 142336, method: "Bank Transfer", reference: "REF-90454", invoice: "STY-INV-0654", status: "Pending" },
  { id: "PYT-2034", date: "2026-06-15", property: "Sakura Ryokan", amount: 138000, method: "Wire", reference: "REF-90453", invoice: "STY-INV-0653", status: "Pending" },
  { id: "PYT-2033", date: "2026-06-15", property: "Casa del Mar", amount: 120000, method: "PayPal", reference: "REF-90452", invoice: "STY-INV-0652", status: "Pending" },
  { id: "PYT-2032", date: "2026-06-15", property: "Alpine Lodge Zermatt", amount: 110000, method: "Wire", reference: "REF-90451", invoice: "STY-INV-0651", status: "Pending" },
  { id: "PYT-2031", date: "2026-05-20", property: "Casa del Mar", amount: 120840, method: "PayPal", reference: "REF-90420", invoice: "STY-INV-0620", status: "Failed" },
  { id: "PYT-2030", date: "2026-05-18", property: "Sakura Ryokan", amount: 100000, method: "Wire", reference: "REF-90418", invoice: "STY-INV-0618", status: "Failed" },
]

const sumBy = (status: Payout["status"]) =>
  payouts.filter((p) => p.status === status).reduce((s, p) => s + p.amount, 0)
const countBy = (status: Payout["status"]) =>
  payouts.filter((p) => p.status === status).length

export const payoutStats = {
  totalPaid: sumBy("Paid"),
  pending: sumBy("Pending"),
  pendingCount: countBy("Pending"),
  failed: sumBy("Failed"),
  failedCount: countBy("Failed"),
  totalVolume: payouts.reduce((s, p) => s + p.amount, 0),
  count: payouts.length,
}

/* ------------------------------- Invoices ------------------------------ */

export const invoices: Invoice[] = [
  { id: "STY-INV-0655", issued: "2026-06-01", due: "2026-06-30", property: "Grand Horizon", subtotal: 22222, tax: 1778, total: 24000, status: "Outstanding" },
  { id: "STY-INV-0654", issued: "2026-06-01", due: "2026-06-30", property: "The Metropolitan", subtotal: 19907, tax: 1593, total: 21500, status: "Outstanding" },
  { id: "STY-INV-0653", issued: "2026-06-01", due: "2026-06-30", property: "Sakura Ryokan", subtotal: 18359, tax: 1469, total: 19828, status: "Outstanding" },
  { id: "STY-INV-0652", issued: "2026-06-05", due: "2026-07-05", property: "Casa del Mar", subtotal: 18519, tax: 1481, total: 20000, status: "Outstanding" },
  { id: "STY-INV-0651", issued: "2026-06-05", due: "2026-07-05", property: "Alpine Lodge Zermatt", subtotal: 16204, tax: 1296, total: 17500, status: "Outstanding" },
  { id: "STY-INV-0612", issued: "2026-05-01", due: "2026-05-31", property: "Grand Horizon", subtotal: 20370, tax: 1630, total: 22000, status: "Paid" },
  { id: "STY-INV-0611", issued: "2026-05-01", due: "2026-05-31", property: "The Metropolitan", subtotal: 18385, tax: 1471, total: 19856, status: "Paid" },
  { id: "STY-INV-0610", issued: "2026-05-01", due: "2026-05-31", property: "Sakura Ryokan", subtotal: 16667, tax: 1333, total: 18000, status: "Paid" },
  { id: "STY-INV-0588", issued: "2026-05-01", due: "2026-05-31", property: "Casa del Mar", subtotal: 18519, tax: 1481, total: 20000, status: "Paid" },
  { id: "STY-INV-0587", issued: "2026-05-01", due: "2026-05-31", property: "Alpine Lodge Zermatt", subtotal: 14815, tax: 1185, total: 16000, status: "Paid" },
  { id: "STY-INV-0566", issued: "2026-04-15", due: "2026-05-15", property: "Grand Horizon", subtotal: 21488, tax: 1719, total: 23207, status: "Overdue" },
  { id: "STY-INV-0565", issued: "2026-04-15", due: "2026-05-15", property: "Casa del Mar", subtotal: 18519, tax: 1481, total: 20000, status: "Overdue" },
]

const invSum = (status: Invoice["status"]) =>
  invoices.filter((i) => i.status === status).reduce((s, i) => s + i.total, 0)
const invCount = (status: Invoice["status"]) =>
  invoices.filter((i) => i.status === status).length

export const invoiceStats = {
  outstanding: invSum("Outstanding"),
  outstandingCount: invCount("Outstanding"),
  paid: invSum("Paid"),
  paidCount: invCount("Paid"),
  overdue: invSum("Overdue"),
  overdueCount: invCount("Overdue"),
  totalVolume: invoices.reduce((s, i) => s + i.total, 0),
  count: invoices.length,
}
