/**
 * Barrel + derived aggregates for the admin panel's mock dataset.
 *
 * Every count exposed here is computed from the source arrays rather than
 * written by hand. That is what keeps the sidebar badges, stat tiles and table
 * headers in agreement — the Figma had them disagreeing on nearly every
 * screen (Managers "34" over a 10-row table, Inbox "5"/"1"/"9", Properties
 * "3"/"12"/"14").
 */

import type { BadgeKey } from "@/lib/admin/nav"
import type { Stat } from "@/lib/extranet/types"

import { adminClients, adminGuests } from "./clients"
import { adminProperties } from "./properties"
import {
  adminCancellations,
  adminManagers,
  adminReservations,
  adminReviews,
  adminThreads,
} from "./operations"
import {
  COMMISSION_RATE,
  adminCommissionInvoices,
  outstandingInvoicesTotal,
  platformAvgAdr,
  platformAvgOccupancy,
  totalBookingsYtd,
  totalCommissionYtd,
  totalRevenueYtd,
} from "./finance"
import { adminBillingInvoices, adminContent } from "./platform"
import { dashboardSeries } from "./marketing"

export * from "./clients"
export * from "./properties"
export * from "./operations"
export * from "./finance"
export * from "./marketing"
export * from "./platform"

/* -------------------------------------------------------- derived counts */

export const propertiesPendingCount = adminProperties.filter(
  (p) => p.status === "Pending"
).length

export const usersInvitedCount = adminManagers.filter(
  (m) => m.status === "Invited"
).length

export const inboxUnreadCount = adminThreads.filter((t) => t.unread).length

export const openTicketCount = adminThreads.filter(
  (t) => t.kind === "ticket" && t.status !== "Resolved"
).length

export const reviewsToModerateCount = adminReviews.filter(
  (r) => r.status === "Flagged" || r.status === "Pending Review"
).length

export const contentToModerateCount = adminContent.filter(
  (c) => c.status === "Flagged" || c.status === "Pending Review"
).length

export const billingUnpaidCount = adminBillingInvoices.filter(
  (i) => i.status !== "Paid"
).length

/** Reservations that are current or upcoming, i.e. still consuming inventory. */
export const activeReservationCount = adminReservations.filter((r) =>
  ["Pending", "Confirmed", "Checked In"].includes(r.status)
).length

/** Everything sitting in an admin's queue right now. */
export const pendingApprovalsCount =
  propertiesPendingCount +
  contentToModerateCount +
  reviewsToModerateCount +
  usersInvitedCount +
  adminCommissionInvoices.filter((i) => i.status === "Overdue").length

/** Feeds the sidebar. Keys match `BadgeKey` in `lib/admin/nav.ts`. */
export const badgeCounts: Record<BadgeKey, number> = {
  propertiesPending: propertiesPendingCount,
  usersInvited: usersInvitedCount,
  reservations: adminReservations.length,
  inboxUnread: inboxUnreadCount,
  reviewsToModerate: reviewsToModerateCount,
  contentToModerate: contentToModerateCount,
  billingUnpaid: billingUnpaidCount,
}

/* ---------------------------------------------------------- stat tiles */

const currentMonth = dashboardSeries[dashboardSeries.length - 1]

/** The eight tiles on `/admin`. Values derived; deltas are editorial. */
export const dashboardStats: Stat[] = [
  {
    label: "Total Clients",
    value: String(adminClients.length),
    delta: "+20%",
    trend: "up",
    caption: "vs last quarter",
    icon: "Building2",
  },
  {
    label: "Total Properties",
    value: String(adminProperties.length),
    delta: "+9.1%",
    trend: "up",
    caption: "vs last quarter",
    icon: "Hotel",
  },
  {
    label: "Active Reservations",
    value: String(activeReservationCount),
    delta: "+14.3%",
    trend: "up",
    caption: `current · ${totalBookingsYtd.toLocaleString("en-US")} YTD`,
    icon: "CalendarCheck",
  },
  {
    label: "Platform Revenue",
    value: `$${currentMonth.revenue.toLocaleString("en-US")}`,
    delta: "+12.8%",
    trend: "up",
    caption: "this month",
    icon: "DollarSign",
  },
  {
    label: "Commission Earned",
    value: `$${Math.round(currentMonth.revenue * COMMISSION_RATE).toLocaleString("en-US")}`,
    delta: "+15.2%",
    trend: "up",
    caption: `${COMMISSION_RATE * 100}% of revenue`,
    icon: "Percent",
  },
  {
    label: "Avg. Occupancy",
    value: `${platformAvgOccupancy.toFixed(0)}%`,
    delta: "+3.5%",
    trend: "up",
    caption: "weighted by rooms",
    icon: "BedDouble",
  },
  {
    label: "Pending Approvals",
    value: String(pendingApprovalsCount),
    delta: "+33.3%",
    trend: "down",
    caption: "properties, content, reviews",
    icon: "Clock",
  },
  {
    label: "Support Tickets",
    value: String(openTicketCount),
    delta: "−12.5%",
    trend: "up",
    caption: "open across platform",
    icon: "MessageSquare",
  },
]

/** The six tiles that persist across all five Finance tabs. */
export const financeStats: Stat[] = [
  {
    label: "Total Platform Revenue",
    value: `$${(totalRevenueYtd / 1_000_000).toFixed(2)}M`,
    delta: "+18.2%",
    trend: "up",
    caption: "year to date",
    icon: "DollarSign",
  },
  {
    label: "Total Commissions",
    value: `$${(totalCommissionYtd / 1_000_000).toFixed(2)}M`,
    delta: "+15.8%",
    trend: "up",
    caption: "year to date",
    icon: "Percent",
  },
  {
    label: "Total Payouts (MTD)",
    value: `$${Math.round(totalCommissionYtd / 12 / 1000)}K`,
    delta: "+12.4%",
    trend: "up",
    caption: "this month",
    icon: "Wallet",
  },
  {
    label: "Platform Avg Occupancy",
    value: `${platformAvgOccupancy.toFixed(1)}%`,
    delta: "+4.3pp",
    trend: "up",
    icon: "BedDouble",
  },
  {
    label: "Avg ADR",
    value: `$${platformAvgAdr.toFixed(0)}`,
    delta: "+8.5%",
    trend: "up",
    caption: "weighted by bookings",
    icon: "Tag",
  },
  {
    label: "Outstanding Invoices",
    value: `$${(outstandingInvoicesTotal / 1000).toFixed(1)}K`,
    delta: "−5.2%",
    trend: "up",
    caption: "pending + overdue",
    icon: "FileText",
  },
]

/** Counts shown above the Cancellations table. */
export const cancellationCount = adminCancellations.length

/** Guests, for the tiles above the guest table. */
export const guestCounts = {
  total: adminGuests.length,
  active: adminGuests.filter((g) => g.status === "Active").length,
  suspended: adminGuests.filter((g) => g.status === "Suspended").length,
  blocked: adminGuests.filter((g) => g.status === "Blocked").length,
}
