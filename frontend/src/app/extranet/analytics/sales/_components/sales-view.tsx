"use client"

import type { Stat, SeriesPoint } from "@/lib/extranet/types"
import { BarChart } from "@/components/extranet/charts/bar-chart"
import { formatCurrency } from "@/lib/format"
import { useSales } from "@/lib/api/hooks"
import {
  AnalyticsRangeBar,
  delta,
  money,
  useAnalyticsRange,
} from "@/components/extranet/analytics-range"
import { SectionCard, StatGrid } from "@/components/extranet/shared"

/**
 * Sales, by the date a booking was MADE (rule #62).
 *
 * That is not the same question as Performance, which counts by the night
 * stayed — and the two will disagree, correctly, whenever bookings and stays
 * fall in different months. The old screen printed six fixed bars under the
 * words "Last 6 months" and could not have told you which of the two it meant.
 *
 * Commission is shown beside revenue rather than netted off it. They are three
 * different words for three different numbers, and a screen that quietly
 * subtracts one from the other is how a partner ends up disputing a payout.
 */
export function SalesView() {
  const { range, granularity, controls } = useAnalyticsRange(90)
  const sales = useSales({ ...range, granularity })

  const totals = sales.data?.totals
  const previous = sales.data?.previous

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
      caption: "gross, before commission",
    },
    {
      label: "Commission",
      value: totals ? money(totals.commission, formatCurrency) : "—",
      caption: "what the platform keeps",
    },
    {
      label: "Net",
      value:
        totals && totals.revenue !== null && totals.commission !== null
          ? formatCurrency((totals.revenue - totals.commission))
          : "—",
      caption: "revenue less commission",
    },
    {
      label: "Fees",
      value: totals ? money(totals.fees, formatCurrency) : "—",
      // Real money, but no room was sold for it (rule #63).
      caption: "cancellation and no-show",
    },
    {
      label: "Cancelled",
      value: totals ? String(totals.cancelled) : "—",
      caption: "booked then cancelled",
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

      {sales.isPending ? (
        <div className="bg-muted h-72 animate-pulse rounded-xl" aria-busy="true" />
      ) : sales.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {sales.error.message}
        </div>
      ) : (
        <>
          <StatGrid stats={stats} className="sm:grid-cols-3 lg:grid-cols-6" />

          <SectionCard
            title="Revenue by booking date"
            description={`Grouped by ${sales.data?.granularity ?? granularity}. Bars are revenue, the line is bookings.`}
          >
            {series.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nothing was booked in this window.
              </p>
            ) : (
              /*
               * The empty case never reaches the chart.
               *
               * The SVG scales its bars against the largest value, so an empty
               * series is a divide by zero that renders as an invisible chart
               * rather than an error — the worst of both.
               */
              <BarChart
                data={series}
                showLine
                formatTick={(n) => `$${Math.round(n / 1000)}k`}
                legendPrimary="Revenue"
                legendSecondary="Bookings"
              />
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
