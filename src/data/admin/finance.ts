import type {
  CommissionInvoice,
  CommissionInvoiceStatus,
  CommissionRow,
  Payout,
  PayoutStatus,
  RevenueRow,
} from "@/lib/admin/types"
import { clientById, adminClients } from "./clients"
import { propertyById, taxRuleForCountry } from "./properties"

/** Standard platform commission — also the default on `/admin/settings`. */
export const COMMISSION_RATE = 0.15

/**
 * Year-to-date revenue per property. All figures USD (Phase 1 decision D4);
 * the Figma's PKR finance tables were rebuilt onto these properties.
 * Headline totals are summed from this array, never hardcoded.
 */
export const adminRevenueRows: RevenueRow[] = [
  { propertyId: "HTL-1001", revenueYtd: 2_840_000, prevYear: 2_380_000, bookings: 1_340, adr: 389, revpar: 265, occupancy: 78, growth: 19.3 },
  { propertyId: "HTL-1003", revenueYtd: 2_150_000, prevYear: 1_920_000, bookings: 780, adr: 520, revpar: 374, occupancy: 62, growth: 12.0 },
  { propertyId: "HTL-1002", revenueYtd: 1_980_000, prevYear: 1_820_000, bookings: 1_180, adr: 275, revpar: 223, occupancy: 85, growth: 8.8 },
  { propertyId: "HTL-1004", revenueYtd: 1_680_000, prevYear: 1_510_000, bookings: 1_020, adr: 210, revpar: 145, occupancy: 58, growth: 11.3 },
  { propertyId: "HTL-1005", revenueYtd: 1_420_000, prevYear: 1_280_000, bookings: 860, adr: 450, revpar: 256, occupancy: 71, growth: 10.9 },
  { propertyId: "HTL-1006", revenueYtd: 1_240_000, prevYear: 1_140_000, bookings: 910, adr: 290, revpar: 232, occupancy: 80, growth: 8.8 },
  { propertyId: "HTL-1008", revenueYtd: 980_000, prevYear: 890_000, bookings: 1_450, adr: 165, revpar: 149, occupancy: 90, growth: 10.1 },
  { propertyId: "HTL-1009", revenueYtd: 890_000, prevYear: 760_000, bookings: 620, adr: 420, revpar: 273, occupancy: 65, growth: 17.1 },
  { propertyId: "HTL-1012", revenueYtd: 620_000, prevYear: 545_000, bookings: 480, adr: 340, revpar: 231, occupancy: 68, growth: 13.8 },
  { propertyId: "HTL-1010", revenueYtd: 310_000, prevYear: 420_000, bookings: 210, adr: 310, revpar: 84, occupancy: 27, growth: -26.2 },
]

export const totalRevenueYtd = adminRevenueRows.reduce(
  (sum, r) => sum + r.revenueYtd,
  0
)

export const totalBookingsYtd = adminRevenueRows.reduce(
  (sum, r) => sum + r.bookings,
  0
)

export const totalPrevYearRevenue = adminRevenueRows.reduce(
  (sum, r) => sum + r.prevYear,
  0
)

export const yoyGrowth =
  ((totalRevenueYtd - totalPrevYearRevenue) / totalPrevYearRevenue) * 100

/** Commission is derived from revenue — never a second source of truth. */
export const adminCommissionRows: CommissionRow[] = adminRevenueRows.map(
  (r) => ({
    propertyId: r.propertyId,
    revenueYtd: r.revenueYtd,
    rate: COMMISSION_RATE,
    commissionYtd: Math.round(r.revenueYtd * COMMISSION_RATE),
    nextPayoutEst: Math.round((r.revenueYtd * COMMISSION_RATE) / 12),
  })
)

export const totalCommissionYtd = adminCommissionRows.reduce(
  (sum, r) => sum + r.commissionYtd,
  0
)

export const totalNextPayoutEst = adminCommissionRows.reduce(
  (sum, r) => sum + r.nextPayoutEst,
  0
)

function ownerFor(propertyId: string) {
  const property = propertyById(propertyId)
  return property ? (clientById(property.clientId)?.contactPerson ?? "—") : "—"
}

/** [id, propertyId, amount, method, date, status, reference, failureReason] */
const PAYOUT_ROWS: [
  string,
  string,
  number,
  string,
  string,
  PayoutStatus,
  string,
  string | null,
][] = [
  ["PYT-9100", "HTL-1001", 184_800, "Bank Transfer", "2026-07-29", "Pending", "ACH-TRF-9942", null],
  ["PYT-9099", "HTL-1003", 151_200, "Bank Transfer", "2026-07-29", "Pending", "SEPA-TRF-9941", null],
  ["PYT-9098", "HTL-1002", 74_160, "Bank Transfer", "2026-07-28", "Pending", "ACH-TRF-9938", null],
  ["PYT-9097", "HTL-1005", 43_200, "Bank Transfer", "2026-07-27", "Pending", "JPY-TRF-9935", null],
  ["PYT-9096", "HTL-1004", 50_760, "Bank Transfer", "2026-07-27", "Pending", "MXN-TRF-9934", null],
  ["PYT-9095", "HTL-1006", 113_850, "Bank Transfer", "2026-07-05", "Paid", "BACS-TRF-9930", null],
  ["PYT-9094", "HTL-1009", 127_800, "Bank Transfer", "2026-07-05", "Paid", "AED-TRF-9929", null],
  ["PYT-9093", "HTL-1001", 174_240, "Bank Transfer", "2026-07-05", "Paid", "ACH-TRF-9928", null],
  ["PYT-9092", "HTL-1003", 142_020, "Bank Transfer", "2026-07-05", "Paid", "SEPA-TRF-9927", null],
  ["PYT-9091", "HTL-1002", 70_380, "Bank Transfer", "2026-07-05", "Paid", "ACH-TRF-9926", null],
  ["PYT-9090", "HTL-1008", 23_120, "Bank Transfer", "2026-07-05", "Paid", "BACS-TRF-9925", null],
  ["PYT-9089", "HTL-1012", 15_480, "Stripe", "2026-07-05", "Paid", "STR-9924", null],
  ["PYT-9088", "HTL-1005", 9_216, "Stripe", "2026-07-05", "Paid", "STR-9923", null],
  ["PYT-9087", "HTL-1006", 110_250, "Bank Transfer", "2026-07-01", "Paid", "BACS-TRF-9920", null],
  ["PYT-9086", "HTL-1010", 58_050, "Bank Transfer", "2026-06-28", "Failed", "IBAN-TRF-9918", "Beneficiary account closed — awaiting updated bank details from the client."],
  ["PYT-9085", "HTL-1010", 88_700, "Bank Transfer", "2026-06-15", "Failed", "IBAN-TRF-9911", "Payout blocked while the client's subscription is past due."],
]

export const adminPayouts: Payout[] = PAYOUT_ROWS.map(
  ([id, propertyId, amount, method, date, status, reference, failureReason]) => ({
    id,
    propertyId,
    ownerName: ownerFor(propertyId),
    amount,
    method,
    date,
    status,
    reference,
    failureReason,
  })
)

export const payoutsPaidTotal = adminPayouts
  .filter((p) => p.status === "Paid")
  .reduce((sum, p) => sum + p.amount, 0)

export const payoutsPendingTotal = adminPayouts
  .filter((p) => p.status === "Pending")
  .reduce((sum, p) => sum + p.amount, 0)

export const propertiesPaidCount = new Set(
  adminPayouts.filter((p) => p.status === "Paid").map((p) => p.propertyId)
).size

/** [id, propertyId, subtotal, issued, due, status, periodStart, periodEnd, bookings] */
const INVOICE_ROWS: [
  string,
  string,
  number,
  string,
  string,
  CommissionInvoiceStatus,
  string,
  string,
  number,
][] = [
  ["STY-INV-2026-0625", "HTL-1001", 26_336, "2026-07-09", "2026-07-16", "Pending", "2026-06-26", "2026-07-08", 42],
  ["STY-INV-2026-0624", "HTL-1003", 21_965, "2026-07-09", "2026-07-16", "Pending", "2026-06-26", "2026-07-08", 31],
  ["STY-INV-2026-0623", "HTL-1002", 9_071, "2026-07-09", "2026-07-16", "Pending", "2026-06-26", "2026-07-08", 38],
  ["STY-INV-2026-0622", "HTL-1005", 6_066, "2026-07-09", "2026-07-16", "Pending", "2026-06-26", "2026-07-08", 19],
  ["STY-INV-2026-0621", "HTL-1004", 3_164, "2026-07-09", "2026-07-16", "Pending", "2026-06-26", "2026-07-08", 24],
  ["STY-INV-2026-0620", "HTL-1006", 5_818, "2026-07-09", "2026-07-16", "Pending", "2026-06-26", "2026-07-08", 29],
  ["STY-INV-2026-0619", "HTL-1008", 2_681, "2026-07-09", "2026-07-16", "Pending", "2026-06-26", "2026-07-08", 47],
  ["STY-INV-2026-0618", "HTL-1012", 13_739, "2026-07-09", "2026-07-16", "Pending", "2026-06-26", "2026-07-08", 16],
  ["STY-INV-2026-0617", "HTL-1009", 17_330, "2026-07-01", "2026-07-08", "Paid", "2026-06-12", "2026-06-25", 22],
  ["STY-INV-2026-0616", "HTL-1001", 19_766, "2026-07-01", "2026-07-08", "Paid", "2026-06-12", "2026-06-25", 35],
  ["STY-INV-2026-0615", "HTL-1003", 26_336, "2026-07-01", "2026-07-08", "Paid", "2026-06-12", "2026-06-25", 28],
  ["STY-INV-2026-0614", "HTL-1002", 13_739, "2026-06-01", "2026-06-08", "Overdue", "2026-05-12", "2026-05-25", 33],
  ["STY-INV-2026-0613", "HTL-1010", 5_818, "2026-05-28", "2026-06-04", "Overdue", "2026-05-08", "2026-05-21", 12],
  ["STY-INV-2026-0612", "HTL-1005", 6_066, "2026-05-15", "2026-05-22", "Overdue", "2026-04-26", "2026-05-09", 17],
  ["STY-INV-2026-0611", "HTL-1004", 3_164, "2026-05-15", "2026-05-22", "Overdue", "2026-04-26", "2026-05-09", 21],
  ["STY-INV-2026-0610", "HTL-1010", 13_739, "2026-04-01", "2026-04-08", "Void", "2026-03-12", "2026-03-25", 14],
  ["STY-INV-2026-0609", "HTL-1010", 5_818, "2026-03-01", "2026-03-08", "Void", "2026-02-12", "2026-02-25", 11],
]

export const adminCommissionInvoices: CommissionInvoice[] = INVOICE_ROWS.map(
  ([id, propertyId, subtotal, issued, due, status, periodStart, periodEnd, bookings]) => {
    const property = propertyById(propertyId)
    const rule = taxRuleForCountry(property?.country ?? "United States")
    const taxRate = Number.parseFloat(rule.rate) / 100
    return {
      id,
      propertyId,
      ownerName: ownerFor(propertyId),
      subtotal,
      taxRate,
      taxLabel: rule.name,
      total: Math.round(subtotal * (1 + taxRate)),
      issued,
      due,
      status,
      periodStart,
      periodEnd,
      bookings,
    }
  }
)

export const outstandingInvoicesTotal = adminCommissionInvoices
  .filter((i) => i.status === "Pending" || i.status === "Overdue")
  .reduce((sum, i) => sum + i.total, 0)

/** Platform-wide average occupancy, weighted by room count. */
export const platformAvgOccupancy = (() => {
  const rows = adminRevenueRows
    .map((r) => ({ row: r, property: propertyById(r.propertyId) }))
    .filter((x) => x.property)
  const rooms = rows.reduce((sum, x) => sum + x.property!.rooms, 0)
  const weighted = rows.reduce(
    (sum, x) => sum + x.row.occupancy * x.property!.rooms,
    0
  )
  return weighted / rooms
})()

export const platformAvgAdr = (() => {
  const weighted = adminRevenueRows.reduce(
    (sum, r) => sum + r.adr * r.bookings,
    0
  )
  return weighted / totalBookingsYtd
})()

/** Revenue attributable to each client, summed from its properties. */
export function revenueForClient(clientId: string) {
  return adminRevenueRows
    .filter((r) => propertyById(r.propertyId)?.clientId === clientId)
    .reduce((sum, r) => sum + r.revenueYtd, 0)
}

export const clientRevenueTotals = adminClients.map((c) => ({
  clientId: c.id,
  revenue: revenueForClient(c.id),
}))
