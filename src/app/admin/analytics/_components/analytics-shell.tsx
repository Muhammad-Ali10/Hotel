"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { useAnalyticsSummary } from "@/lib/admin/api/hooks"
import { AdminPageHeader, InfoNote, StatGrid } from "@/components/admin/shared"
import { StatGridSkeleton } from "@/components/shared/data-table"
import { ErrorState } from "@/components/shared/states"

const TABS = [
  { label: "Overview", href: "/admin/analytics" },
  { label: "Demand", href: "/admin/analytics/demand" },
]

export function AnalyticsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data, isLoading, error, refetch } = useAnalyticsSummary()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Analytics"
        subtitle="Cross-client analytics, demand trends, and performance benchmarks"
      />

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <StatGridSkeleton count={6} />
      ) : (
        <StatGrid
          className="lg:grid-cols-3 xl:grid-cols-6"
          stats={[
            {
              label: "Total Clients",
              value: String(data.totals.clients),
              icon: "Building2",
            },
            {
              label: "Total Properties",
              value: String(data.totals.properties),
              icon: "Hotel",
            },
            {
              label: "Total Bookings",
              value: data.totals.bookings.toLocaleString("en-US"),
              icon: "CalendarCheck",
            },
            {
              label: "Avg Occupancy",
              value: `${data.totals.occupancy.toFixed(1)}%`,
              icon: "BedDouble",
            },
            {
              label: "Avg ADR",
              value: `$${data.totals.adr.toFixed(0)}`,
              icon: "Tag",
            },
            {
              label: "Total Revenue",
              value: `$${(data.totals.revenue / 1_000_000).toFixed(1)}M`,
              icon: "DollarSign",
            },
          ]}
        />
      )}

      <nav
        aria-label="Analytics sections"
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

      <InfoNote>
        Platform analytics aggregate data from every client. Property-level
        analytics live in the extranet&rsquo;s Analytics section.
      </InfoNote>
    </div>
  )
}
