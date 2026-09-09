"use client"

import type { SeriesPoint, Stat } from "@/lib/extranet/types"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import { useFinanceRevenue } from "@/lib/api/hooks"
import { BarChart } from "@/components/extranet/charts/bar-chart"
import {
  AnalyticsRangeBar,
  useAnalyticsRange,
} from "@/components/extranet/analytics-range"
import { SectionCard, StatGrid } from "@/components/extranet/shared"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Revenue over time, with the commission never folded in.
 *
 * The bars are NET — what actually reaches the partner — and gross is the line
 * above them, because the gap between the two is the whole point of the
 * screen. A chart of gross alone tells a partner they earned money they will
 * never see; a chart of net alone hides what the platform took.
 */
export function RevenueView() {
  const { range, granularity, controls } = useAnalyticsRange(365)
  const revenue = useFinanceRevenue({ ...range, granularity })

  const totals = revenue.data?.totals

  const stats: Stat[] = [
    { label: "Bookings", value: totals ? String(totals.bookings) : "—" },
    {
      label: "Gross",
      value: totals ? formatCurrency(totals.gross) : "—",
      caption: "what guests paid",
    },
    {
      label: "Commission",
      value: totals ? formatCurrency(totals.commission) : "—",
    },
    {
      label: "Net",
      value: totals ? formatCurrency(totals.net) : "—",
      caption: "what reaches you",
    },
    {
      label: "Refunded",
      value: totals ? formatCurrency(totals.refunded) : "—",
    },
    { label: "Cancelled", value: totals ? String(totals.cancelled) : "—" },
  ]

  const series: SeriesPoint[] = (revenue.data?.points ?? []).map((point) => ({
    label: point.period,
    value: point.net / 100,
    secondary: point.gross / 100,
  }))

  return (
    <div className="space-y-6">
      <AnalyticsRangeBar controls={controls} showGranularity />

      {revenue.isPending ? (
        <div className="bg-muted h-72 animate-pulse rounded-xl" aria-busy="true" />
      ) : revenue.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {revenue.error.message}
        </div>
      ) : (
        <>
          <StatGrid stats={stats} className="sm:grid-cols-3 lg:grid-cols-6" />

          <SectionCard
            title="Net and gross"
            description="Bars are what reaches you; the line is what guests paid. The gap is commission."
          >
            {series.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nothing was booked in this window.
              </p>
            ) : (
              <BarChart
                data={series}
                showLine
                formatTick={(n) => `$${Math.round(n / 1000)}k`}
                legendPrimary="Net"
                legendSecondary="Gross"
              />
            )}
          </SectionCard>

          <div className="space-y-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              By property
            </h2>
            <Card className="py-0">
              <div className="overflow-x-auto">
                <Table className={cellPad}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Refunded</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(revenue.data?.byProperty ?? []).map((row) => (
                      <TableRow key={row.propertyId}>
                        <TableCell className="font-medium">
                          {row.propertyName}
                          <span className="text-muted-foreground"> · {row.city}</span>
                        </TableCell>
                        <TableCell className="text-right">{row.bookings}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.gross)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.commission)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.net)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.refunded)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(revenue.data?.byProperty.length ?? 0) === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-muted-foreground py-8 text-center"
                        >
                          No property traded in this window.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
