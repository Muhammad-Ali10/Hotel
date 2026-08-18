/**
 * The admin sidebar tree — single source of truth for the sidebar, the
 * breadcrumb trail and route-level permission lookups.
 *
 * Badge counts are derived from the canonical dataset (see `badgeCounts`)
 * rather than hardcoded, which is what fixes the Figma's contradictory
 * numbers (Managers "34" vs a 10-row table, Inbox "5"/"1"/"9" on different
 * artboards).
 */

import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Bell,
  Building2,
  CalendarCheck,
  CreditCard,
  FileText,
  Hotel,
  Inbox,
  LayoutDashboard,
  Settings,
  Star,
  Tag,
  UserRound,
  Users,
  Wallet,
} from "lucide-react"

import type { Resource } from "./rbac"

export type AdminNavChild = {
  title: string
  href: string
}

export type AdminNavItem = {
  title: string
  href: string
  icon: LucideIcon
  resource: Resource
  /** Key into the derived badge-count record; omit for no badge. */
  badge?: BadgeKey
  children?: AdminNavChild[]
}

export type BadgeKey =
  | "propertiesPending"
  | "usersInvited"
  | "reservations"
  | "inboxUnread"
  | "reviewsToModerate"
  | "contentToModerate"
  | "billingUnpaid"

export const ADMIN_ROOT = "/admin"

export const adminNav: AdminNavItem[] = [
  {
    title: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    resource: "dashboard",
  },
  {
    title: "Clients",
    href: "/admin/clients",
    icon: Building2,
    resource: "clients",
  },
  {
    title: "Guests",
    href: "/admin/guests",
    icon: UserRound,
    resource: "guests",
  },
  {
    title: "Properties",
    href: "/admin/properties",
    icon: Hotel,
    resource: "properties",
    badge: "propertiesPending",
  },
  {
    title: "Managers & Users",
    href: "/admin/users",
    icon: Users,
    resource: "users",
    badge: "usersInvited",
  },
  {
    title: "Reservations",
    href: "/admin/reservations",
    icon: CalendarCheck,
    resource: "reservations",
    badge: "reservations",
    children: [
      { title: "Reservations List", href: "/admin/reservations" },
      { title: "Cancellations", href: "/admin/reservations/cancellations" },
    ],
  },
  {
    title: "Promotions",
    href: "/admin/promotions",
    icon: Tag,
    resource: "promotions",
    children: [
      { title: "Active Promotions", href: "/admin/promotions" },
      { title: "Discount Rankings", href: "/admin/promotions/rankings" },
    ],
  },
  {
    title: "Inbox",
    href: "/admin/inbox",
    icon: Inbox,
    resource: "inbox",
    badge: "inboxUnread",
  },
  {
    title: "Guest Reviews",
    href: "/admin/reviews",
    icon: Star,
    resource: "reviews",
    badge: "reviewsToModerate",
  },
  {
    title: "Finance",
    href: "/admin/finance",
    icon: Wallet,
    resource: "finance",
    children: [
      { title: "Finance Overview", href: "/admin/finance" },
      { title: "Revenue", href: "/admin/finance/revenue" },
      { title: "Commissions", href: "/admin/finance/commissions" },
      { title: "Payouts", href: "/admin/finance/payouts" },
      { title: "Invoices", href: "/admin/finance/invoices" },
    ],
  },
  {
    title: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    resource: "analytics",
    children: [
      { title: "Overview", href: "/admin/analytics" },
      { title: "Demand", href: "/admin/analytics/demand" },
    ],
  },
  {
    title: "Content & Descriptions",
    href: "/admin/content",
    icon: FileText,
    resource: "content",
    badge: "contentToModerate",
  },
  {
    title: "Subscriptions & Billing",
    href: "/admin/billing",
    icon: CreditCard,
    resource: "billing",
    badge: "billingUnpaid",
  },
  {
    title: "Notifications & Audit",
    href: "/admin/audit",
    icon: Bell,
    resource: "audit",
  },
  {
    title: "Settings",
    href: "/admin/settings",
    icon: Settings,
    resource: "settings",
  },
]

/** True when `href` is `pathname` or one of its ancestor segments. */
function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

/**
 * Resolves a pathname to the resource it belongs to, so the layout can gate
 * the whole route without every page repeating the check.
 */
export function resourceForPath(pathname: string): Resource {
  const item = adminNav
    .filter((n) => n.href !== ADMIN_ROOT && matches(pathname, n.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
  return item?.resource ?? "dashboard"
}
