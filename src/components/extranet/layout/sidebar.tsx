"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Building2,
  CalendarCheck,
  ChevronRight,
  Hotel,
  Inbox,
  LayoutDashboard,
  Percent,
  Settings,
  Star,
  Tag,
  TrendingUp,
  Wallet,
} from "lucide-react"

import { AppSidebar, type AppNavEntry } from "@/components/shared/app-sidebar"

export const nav: AppNavEntry[] = [
  { title: "Dashboard", href: "/extranet", icon: LayoutDashboard },
  {
    title: "Reservations",
    href: "/extranet/reservations",
    icon: CalendarCheck,
    badge: 15,
    children: [
      { title: "Reservations List", href: "/extranet/reservations" },
      { title: "Cancellations", href: "/extranet/reservations/cancellations" },
    ],
  },
  { title: "Properties", href: "/extranet/properties", icon: Building2 },
  {
    title: "Property",
    href: "/extranet/property",
    icon: Hotel,
    children: [
      { title: "Property Info", href: "/extranet/property" },
      { title: "VAT / Tax / Charges", href: "/extranet/property/vat-tax" },
      { title: "Room Types", href: "/extranet/property/room-types" },
      { title: "Amenities", href: "/extranet/property/amenities" },
      { title: "Photos", href: "/extranet/property/photos" },
      { title: "Policies", href: "/extranet/property/policies" },
      { title: "Reservation Policies", href: "/extranet/property/reservation-policies" },
      { title: "Facilities & Services", href: "/extranet/property/facilities" },
      { title: "View Your Descriptions", href: "/extranet/property/descriptions" },
      { title: "Messaging Preferences", href: "/extranet/property/messaging" },
      { title: "Property Page Score", href: "/extranet/property/score" },
    ],
  },
  {
    title: "Rates & Availability",
    href: "/extranet/rates",
    icon: Tag,
    children: [
      { title: "Rate Plans", href: "/extranet/rates" },
      { title: "Calendar", href: "/extranet/rates/calendar" },
      { title: "Availability Planner", href: "/extranet/rates/availability" },
      { title: "Open / Close Rooms", href: "/extranet/rates/open-close" },
      { title: "Copy Rates to Future Dates", href: "/extranet/rates/copy-rates" },
      { title: "Restriction Rules", href: "/extranet/rates/restrictions" },
      { title: "Pricing Per Guest", href: "/extranet/rates/pricing-per-guest" },
      { title: "Country Rates", href: "/extranet/rates/country-rates" },
      { title: "Mobile Rates", href: "/extranet/rates/mobile-rates" },
      { title: "Value Adds", href: "/extranet/rates/value-adds" },
    ],
  },
  {
    title: "Promotions",
    href: "/extranet/promotions",
    icon: Percent,
    children: [
      { title: "Active Promotions", href: "/extranet/promotions" },
      { title: "Choose Promotion", href: "/extranet/promotions/choose" },
      { title: "Simulate Discount", href: "/extranet/promotions/simulate" },
    ],
  },
  {
    title: "Boost Performance",
    href: "/extranet/boost",
    icon: TrendingUp,
    children: [
      { title: "Opportunity Center", href: "/extranet/boost" },
      { title: "Genius Partner", href: "/extranet/boost/genius" },
      { title: "Preferred Partner", href: "/extranet/boost/preferred" },
      { title: "Long Stays Toolkit", href: "/extranet/boost/long-stays" },
      { title: "Room Differentiation", href: "/extranet/boost/room-differentiation" },
    ],
  },
  {
    title: "Inbox",
    href: "/extranet/inbox",
    icon: Inbox,
    badge: 7,
    children: [
      { title: "Messages", href: "/extranet/inbox" },
      { title: "Support", href: "/extranet/inbox/support" },
      { title: "Guest Communications", href: "/extranet/inbox/communications" },
    ],
  },
  { title: "Guest Reviews", href: "/extranet/reviews", icon: Star, badge: 25 },
  {
    title: "Finance",
    href: "/extranet/finance",
    icon: Wallet,
    children: [
      { title: "Overview", href: "/extranet/finance" },
      { title: "Revenue Tracking", href: "/extranet/finance/revenue" },
      { title: "Commission Reports", href: "/extranet/finance/commissions" },
      { title: "Payouts", href: "/extranet/finance/payouts" },
      { title: "Invoices", href: "/extranet/finance/invoices" },
    ],
  },
  {
    title: "Analytics",
    href: "/extranet/analytics",
    icon: BarChart3,
    children: [
      { title: "Overview", href: "/extranet/analytics" },
      { title: "Sales Statistics", href: "/extranet/analytics/sales" },
      { title: "Pace of Bookings", href: "/extranet/analytics/pace" },
      { title: "Demand for City", href: "/extranet/analytics/demand" },
      { title: "Booker Insights", href: "/extranet/analytics/bookers" },
      { title: "Book Window", href: "/extranet/analytics/book-window" },
      { title: "Cancellations", href: "/extranet/analytics/cancellations" },
      { title: "Comparable Properties", href: "/extranet/analytics/comparables" },
      { title: "Genius Report", href: "/extranet/analytics/genius" },
      { title: "Ranking", href: "/extranet/analytics/ranking" },
      { title: "Performance", href: "/extranet/analytics/performance" },
    ],
  },
  {
    title: "Account",
    href: "/extranet/account",
    icon: Settings,
    children: [
      { title: "Profile & Team", href: "/extranet/account" },
      { title: "Contacts", href: "/extranet/account/contacts" },
      { title: "My Devices", href: "/extranet/account/devices" },
      { title: "Connectivity", href: "/extranet/account/connectivity" },
      { title: "Contracts", href: "/extranet/account/contracts" },
      { title: "Compliance", href: "/extranet/account/compliance" },
      { title: "Change Password", href: "/extranet/account/change-password" },
    ],
  },
]

export function ExtranetSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <AppSidebar
      nav={nav}
      root="/extranet"
      pathname={pathname}
      onNavigate={onNavigate}
      brand={
        <Link
          href="/extranet"
          onClick={onNavigate}
          className="flex items-center gap-3 border-b p-4"
        >
          <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Hotel className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-heading truncate text-sm font-semibold">
              Aurora Hospitality
            </p>
            <p className="text-muted-foreground text-xs">5 properties</p>
          </div>
        </Link>
      }
      footer={
        <div className="border-t p-3">
          <Link
            href="/"
            onClick={onNavigate}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <ChevronRight className="size-4 rotate-180" />
            Back to Stayora
          </Link>
        </div>
      }
    />
  )
}
