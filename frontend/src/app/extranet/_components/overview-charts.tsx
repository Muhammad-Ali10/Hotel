"use client"

import * as React from "react"

import type { SeriesPoint } from "@/lib/extranet/types"
import { addDays, toISODate } from "@/lib/domain"
import { useBookers, useSales } from "@/lib/api/hooks"
import { SectionCard } from "@/components/extranet/shared"
import { BarChart, DonutChart } from "@/components/extranet/charts"

/**
 * The dashboard's charts.
 *
 * All three used to come from fixtures, under captions ("Last 6 months",
 * "This week") that described no window the product could produce. Revenue now
 * reads the same `sales` endpoint the Sales screen reads, and sources the same
 * `bookers` endpoint the Who Books screen reads — so the dashboard cannot tell
 * a partner one thing and the detail screen another.
 *
 * Weekly occupancy is gone. It was a bar per weekday with no year attached; a
 * week's occupancy without a date is not a measurement, and the honest version
 * of it is the Availability Planner, which shows the next thirty nights with
 * dates on them.
 */
export function OverviewCharts() {
  const range = React.useMemo(() => {
    const today = toISODate(new Date())
    return { from: addDays(today, -179), to: today }
  }, [])

  const sales = useSales({ ...range, granularity: "month" })
  const bookers = useBookers(range)

  const revenue: SeriesPoint[] = (sales.data?.points ?? []).map((point) => ({
    label: point.period,
    value: (point.revenue ?? 0) / 100,
    secondary: point.bookings,
  }))

  const sources = (bookers.data?.bySource ?? []).map((row) => ({
    label: row.segment,
    value: row.bookings,
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard
        title="Revenue"
        description="Last six months, by the date each booking was made"
        className="lg:col-span-2"
      >
        {sales.isPending ? (
          <div className="bg-muted h-48 animate-pulse rounded-lg" aria-busy="true" />
        ) : revenue.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Nothing was booked in the last six months.
          </p>
        ) : (
          <BarChart
            data={revenue}
            showLine
            formatTick={(n) => `$${Math.round(n / 1000)}k`}
            legendPrimary="Revenue"
            legendSecondary="Bookings"
          />
        )}
      </SectionCard>

      <SectionCard
        title="Booking sources"
        description={
          sources.length === 0 ? "No bookings yet" : `${sources.length} sources`
        }
      >
        {bookers.isPending ? (
          <div className="bg-muted h-48 animate-pulse rounded-lg" aria-busy="true" />
        ) : sources.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Nothing booked in the last six months.
          </p>
        ) : (
          <DonutChart data={sources} />
        )}
      </SectionCard>
    </div>
  )
}
