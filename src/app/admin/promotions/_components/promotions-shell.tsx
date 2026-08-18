"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { activePromotionBookings, adminPromotions } from "@/data/admin"
import { useAdminCounts } from "@/lib/admin/api/hooks"
import { AdminPageHeader, StatGrid } from "@/components/admin/shared"

const TABS = [
  { label: "Active promotions", href: "/admin/promotions" },
  { label: "Discount rankings", href: "/admin/promotions/rankings" },
]

export function PromotionsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Live counts, so pausing or resuming a campaign updates the tiles.
  const { data: counts } = useAdminCounts()
  const statusCount = (status: string) =>
    counts?.promotions[status] ??
    adminPromotions.filter((p) => p.status === status).length

  return (
    <div className="space-y-6">
      {/* The Figma omitted breadcrumbs on this screen alone — restored here. */}
      <AdminPageHeader
        title="Promotions Oversight"
        subtitle="Manage platform-wide promotional campaigns across all clients"
      />

      <StatGrid
        stats={[
          {
            label: "Active Promos",
            value: String(statusCount("Active")),
            icon: "Tag",
          },
          {
            label: "Total Promotions",
            value: String(counts?.totals.promotions ?? adminPromotions.length),
            icon: "Percent",
          },
          {
            label: "Bookings Generated",
            value: String(counts?.activePromoBookings ?? activePromotionBookings),
            caption: "from active campaigns",
            icon: "CalendarCheck",
          },
          {
            label: "Scheduled",
            value: String(statusCount("Scheduled")),
            icon: "Clock",
          },
        ]}
      />

      <nav
        aria-label="Promotion views"
        className="bg-muted flex flex-wrap gap-1 rounded-lg p-1"
      >
        {TABS.map((tab) => {
          const active = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "focus-visible:ring-ring/50 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
