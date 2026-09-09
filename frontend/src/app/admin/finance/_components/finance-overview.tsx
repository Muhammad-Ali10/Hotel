"use client"

import Link from "next/link"

import { formatCurrency } from "@/lib/format"
import { useFinanceOverview, useFinanceRevenue } from "@/lib/admin/api/hooks"
import {
  DateRangeBar,
  delta,
  useDateRange,
} from "@/components/admin/date-range-bar"
import { SectionCard, StatGrid } from "@/components/admin/shared"
import { DataTableSkeleton, StatGridSkeleton } from "@/components/shared/data-table"
import { ErrorState } from "@/components/shared/states"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * The platform's money, for a window (rule #97).
 *
 * Three words, three numbers, and this screen never uses one where it means
 * another: **gross** is what guests paid, **commission** is what the platform
 * kept, **net** is what reached the properties.
 *
 * Two more that must not be netted together, and are not: `pendingPayouts` is
 * what the platform owes partners, `outstandingInvoices` is what partners owe
 * the platform. A single combined figure hides which way the money is going.
 *
 * The old version reported "year to date" over a fixed table, with a "growth"
 * column that compared against nothing in particular.
 */
export function FinanceOverview() {
  const { range, granularity, controls } = useDateRange(365)
  const overview = useFinanceOverview(range)
  const revenue = useFinanceRevenue({ ...range, granularity })

  const d = overview.data

  return (
    <div className="space-y-6">
      <DateRangeBar controls={controls} showGranularity />

      {overview.error ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : overview.isLoading || !d ? (
        <StatGridSkeleton count={6} />
      ) : (
        <StatGrid
          className="lg:grid-cols-3 xl:grid-cols-6"
          stats={[
            {
              label: "Bookings",
              value: String(d.bookings),
              delta: delta(d.bookings, d.previous.bookings),
              caption: "vs the window before",
            },
            {
              label: "Gross",
              value: formatCurrency(d.gross),
              delta: delta(d.gross, d.previous.gross),
              caption: "what guests paid",
            },
            {
              label: "Commission",
              value: formatCurrency(d.commission),
              delta: delta(d.commission, d.previous.commission),
              caption: "the platform's revenue",
            },
            {
              label: "Net to partners",
              value: formatCurrency(d.net),
              caption: "what reached the properties",
            },
            {
              label: "Owed to partners",
              value: formatCurrency(d.pendingPayouts.amount),
              caption: `${d.pendingPayouts.count} settlements pending`,
            },
            {
              label: "Owed by partners",
              value: formatCurrency(d.outstandingInvoices.amount),
              caption: `${d.outstandingInvoices.count} invoices unpaid`,
            },
          ]}
        />
      )}

      <SectionCard
        title="By property"
        description="Gross, commission and net for each property inside the window."
        contentClassName="px-0"
      >
        {revenue.isLoading ? (
          <DataTableSkeleton columns={6} rows={6} />
        ) : revenue.error ? (
          <ErrorState error={revenue.error} onRetry={() => void revenue.refetch()} />
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
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    Nothing was booked in this window.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            {revenue.data && revenue.data.byProperty.length > 0 ? (
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-6 font-medium">Total</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {revenue.data.totals.bookings}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(revenue.data.totals.gross)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(revenue.data.totals.commission)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(revenue.data.totals.net)}
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">
                    {formatCurrency(revenue.data.totals.refunded)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            ) : null}
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
