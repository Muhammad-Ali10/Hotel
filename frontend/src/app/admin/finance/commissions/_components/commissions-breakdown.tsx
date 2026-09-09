"use client"

import Link from "next/link"

import { formatCurrency } from "@/lib/format"
import { useFinanceCommissions } from "@/lib/admin/api/hooks"
import { DateRangeBar, useDateRange } from "@/components/admin/date-range-bar"
import { SectionCard, StatGrid } from "@/components/admin/shared"
import { DataTableSkeleton } from "@/components/shared/data-table"
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
 * What the platform charged, month by month and property by property.
 *
 * The rate column is the one to be careful with, and the API is careful with
 * it: it is the rate ACHIEVED, weighted by booking value — not the rate on the
 * organisation today. A renegotiation mid-month really did produce two rates,
 * and showing today's figure against last month's money will not reconcile,
 * which is exactly the kind of disagreement that turns into a dispute.
 *
 * A commission voided by a goodwill refund (rule #76) counts as zero rather
 * than vanishing from the month, so the row still explains where the booking
 * went.
 */
export function CommissionsBreakdown() {
  const { range, controls } = useDateRange(365)
  const rows = useFinanceCommissions(range)

  const list = rows.data ?? []
  const totals = list.reduce(
    (acc, row) => ({
      bookings: acc.bookings + row.bookings,
      gross: acc.gross + row.gross,
      commission: acc.commission + row.commission,
      net: acc.net + row.net,
    }),
    { bookings: 0, gross: 0, commission: 0, net: 0 }
  )

  return (
    <div className="space-y-6">
      <DateRangeBar controls={controls} />

      <StatGrid
        className="lg:grid-cols-4"
        stats={[
          {
            label: "Bookings",
            value: rows.isLoading ? "—" : String(totals.bookings),
          },
          {
            label: "Gross",
            value: rows.isLoading ? "—" : formatCurrency(totals.gross),
          },
          {
            label: "Commission",
            value: rows.isLoading ? "—" : formatCurrency(totals.commission),
          },
          {
            label: "Effective rate",
            value:
              rows.isLoading || totals.gross === 0
                ? "—"
                : /*
                   * Recomputed from the money, not averaged from the rates.
                   *
                   * Averaging the per-row percentages weights a $200 month the
                   * same as a $20,000 one.
                   */
                  `${((totals.commission / totals.gross) * 100).toFixed(2)}%`,
          },
        ]}
      />

      <SectionCard title="By month and property" contentClassName="px-0">
        {rows.isLoading ? (
          <DataTableSkeleton columns={7} rows={6} />
        ) : rows.error ? (
          <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-6">
                  Month
                </TableHead>
                <TableHead scope="col">Property</TableHead>
                <TableHead scope="col">Client</TableHead>
                <TableHead scope="col" className="text-right">
                  Gross
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Rate
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Commission
                </TableHead>
                <TableHead scope="col" className="pr-6 text-right">
                  Net
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((row) => (
                <TableRow key={`${row.month}:${row.propertyId}`}>
                  <TableCell className="pl-6 font-medium">{row.month}</TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/properties/${row.propertyId}`}
                      className="hover:text-primary underline-offset-2 hover:underline"
                    >
                      {row.propertyName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/clients/${row.orgId}`}
                      className="text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
                    >
                      {row.orgName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.gross)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(row.rateBps / 100).toFixed(2)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(row.commission)}
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">
                    {formatCurrency(row.net)}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                    No commission was charged in this window.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            {list.length > 0 ? (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="pl-6 font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.gross)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totals.gross === 0
                      ? "—"
                      : `${((totals.commission / totals.gross) * 100).toFixed(2)}%`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(totals.commission)}
                  </TableCell>
                  <TableCell className="pr-6 text-right tabular-nums">
                    {formatCurrency(totals.net)}
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
