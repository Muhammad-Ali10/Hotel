"use client"

import Link from "next/link"

import type { SeriesPoint } from "@/lib/extranet/types"
import { formatCurrency } from "@/lib/format"
import { useFinanceRevenue } from "@/lib/admin/api/hooks"
import { BarChart } from "@/components/extranet/charts/bar-chart"
import {
  DateRangeBar,
  useDateRange,
} from "@/components/admin/date-range-bar"
import { SectionCard, StatGrid } from "@/components/admin/shared"
import { DataTableSkeleton } from "@/components/shared/data-table"
import { ErrorState } from "@/components/shared/states"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Revenue over time, with commission never folded in.
 *
 * The bars are the platform's own revenue — the COMMISSION — and gross is the
 * line above them. That is the right way round for this screen and the wrong
 * way round for the partner's version of it, which is exactly why the two are
 * separate screens: a marketplace earns the commission, a hotel earns the net.
 */
export function RevenueBreakdown() {
  const { range, granularity, controls } = useDateRange(365)
  const revenue = useFinanceRevenue({ ...range, granularity })

  const totals = revenue.data?.totals
  const series: SeriesPoint[] = (revenue.data?.points ?? []).map((point) => ({
    label: point.period,
    value: point.commission / 100,
    secondary: point.gross / 100,
  }))

  return (
    <div className="space-y-6">
      <DateRangeBar controls={controls} showGranularity />

      {revenue.error ? (
        <ErrorState error={revenue.error} onRetry={() => void revenue.refetch()} />
      ) : (
        <>
          <StatGrid
            className="lg:grid-cols-3 xl:grid-cols-6"
            stats={[
              {
                label: "Bookings",
                value: totals ? String(totals.bookings) : "—",
              },
              {
                label: "Gross",
                value: totals ? formatCurrency(totals.gross) : "—",
                caption: "what guests paid",
              },
              {
                label: "Commission",
                value: totals ? formatCurrency(totals.commission) : "—",
                caption: "the platform's revenue",
              },
              {
                label: "Net to partners",
                value: totals ? formatCurrency(totals.net) : "—",
              },
              {
                label: "Refunded",
                value: totals ? formatCurrency(totals.refunded) : "—",
              },
              {
                label: "Cancelled",
                value: totals ? String(totals.cancelled) : "—",
              },
            ]}
          />

          <SectionCard
            title="Commission and gross"
            description="Bars are what the platform earned; the line is what guests paid."
          >
            {revenue.isLoading ? (
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
                legendPrimary="Commission"
                legendSecondary="Gross"
              />
            )}
          </SectionCard>

          <SectionCard title="By property" contentClassName="px-0">
            {revenue.isLoading ? (
              <DataTableSkeleton columns={6} rows={6} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col" className="pl-6">
                      Property
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Bookings
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Gross
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Commission
                    </TableHead>
                    <TableHead scope="col" className="text-right">
                      Net
                    </TableHead>
                    <TableHead scope="col" className="pr-6 text-right">
                      Refunded
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(revenue.data?.byProperty ?? []).map((row) => (
                    <TableRow key={row.propertyId}>
                      <TableCell className="pl-6">
                        <Link
                          href={`/admin/properties/${row.propertyId}`}
                          className="hover:text-primary font-medium underline-offset-2 hover:underline"
                        >
                          {row.propertyName}
                        </Link>
                        <span className="text-muted-foreground block text-xs">
                          {row.city}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.bookings}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.gross)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.commission)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(row.net)}
                      </TableCell>
                      <TableCell className="pr-6 text-right tabular-nums">
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
            )}
          </SectionCard>
        </>
      )}
    </div>
  )
}
