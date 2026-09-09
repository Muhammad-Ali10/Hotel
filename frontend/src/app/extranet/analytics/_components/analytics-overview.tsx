"use client"

import type { Stat, SeriesPoint } from "@/lib/extranet/types"
import { formatCurrency } from "@/lib/format"
import { usePerformance, useSales } from "@/lib/api/hooks"
import { BarChart } from "@/components/extranet/charts/bar-chart"
import {
  AnalyticsRangeBar,
  delta,
  money,
  useAnalyticsRange,
} from "@/components/extranet/analytics-range"
import { SectionCard, StatGrid } from "@/components/extranet/shared"

/**
 * The one screen that has to agree with all the others.
 *
 * So it does not compute anything of its own. The headline numbers come from
 * the same `sales` and `performance` endpoints the dedicated screens read, in
 * the same window — which is the only way "Revenue" here and "Revenue" on
 * Sales Statistics can be the same figure.
 *
 * The old overview printed a fixed twelve-month bar chart and six stats from a
 * fixture, under the words "last 12 months". Nothing on it could be reconciled
 * with anything else in the product.
 */
export function AnalyticsOverview() {
  const { range, granularity, controls } = useAnalyticsRange(365)
  const sales = useSales({ ...range, granularity })
  const performance = usePerformance(range)

  const totals = sales.data?.totals
  const previous = sales.data?.previous
  const rows = performance.data ?? []

  const roomNights = rows.reduce((sum, r) => sum + r.roomNights, 0)
  const available = rows.reduce((sum, r) => sum + r.roomNightsAvailable, 0)

  /*
   * Occupancy across the portfolio, weighted by capacity.
   *
   * Averaging each property's own percentage would let a four-room guesthouse
   * at 100% cancel out a 300-room hotel at 50%.
   */
  const occupancy = available === 0 ? 0 : roomNights / available

  const stats: Stat[] = [
    {
      label: "Bookings",
      value: totals ? String(totals.bookings) : "—",
      delta: delta(totals?.bookings ?? null, previous?.bookings ?? null),
      caption: "vs the window before",
    },
    {
      label: "Revenue",
      value: totals ? money(totals.revenue, formatCurrency) : "—",
      delta: delta(totals?.revenue ?? null, previous?.revenue ?? null),
      caption: "gross, by booking date",
    },
    {
      label: "Commission",
      value: totals ? money(totals.commission, formatCurrency) : "—",
    },
    {
      label: "Room nights",
      value: performance.isPending ? "—" : String(roomNights),
      caption: "by night stayed",
    },
    {
      label: "Occupancy",
      value: performance.isPending ? "—" : `${(occupancy * 100).toFixed(0)}%`,
      caption: "weighted by capacity",
    },
    {
      label: "Cancelled",
      value: totals ? String(totals.cancelled) : "—",
    },
  ]

  const series: SeriesPoint[] = (sales.data?.points ?? []).map((point) => ({
    label: point.period,
    value: (point.revenue ?? 0) / 100,
    secondary: point.bookings,
  }))

  return (
    <div className="space-y-6">
      <AnalyticsRangeBar controls={controls} showGranularity />

      {sales.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {sales.error.message}
        </div>
      ) : null}

      <StatGrid stats={stats} className="sm:grid-cols-3 lg:grid-cols-6" />

      <SectionCard
        title="Revenue trend"
        description={`Grouped by ${sales.data?.granularity ?? granularity}, by the date each booking was made.`}
      >
        {sales.isPending ? (
          <div className="bg-muted h-48 animate-pulse rounded-lg" aria-busy="true" />
        ) : series.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Nothing was booked in this window.
          </p>
        ) : (
          <BarChart
            data={series}
            showLine
            formatTick={(n) => `$${Math.round(n / 1000)}k`}
            legendPrimary="Revenue"
            legendSecondary="Bookings"
          />
        )}
      </SectionCard>

      <p className="text-muted-foreground text-sm">
        Revenue and bookings are counted by the day the booking was MADE; room nights
        and occupancy by the night STAYED. The two windows do not line up, and both
        numbers are right — Sales Statistics and Property Performance each answer one
        of them in full.
      </p>
    </div>
  )
}
