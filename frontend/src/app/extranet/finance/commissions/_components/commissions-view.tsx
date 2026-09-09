"use client"

import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import { useCommissionReport } from "@/lib/api/hooks"
import {
  AnalyticsRangeBar,
  useAnalyticsRange,
} from "@/components/extranet/analytics-range"
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
 * Commission, month by month and property by property.
 *
 * The rate column is the one to be careful with: it is the rate ACHIEVED,
 * weighted by booking value — not the rate on the organisation today. A
 * renegotiation mid-month really did produce two rates, and showing today's
 * figure against last month's money will not reconcile, which is exactly the
 * kind of disagreement that turns into a support ticket.
 */
export function CommissionsView() {
  const { range, controls } = useAnalyticsRange(365)
  const rows = useCommissionReport(range)

  const list = rows.data ?? []
  const total = list.reduce(
    (acc, row) => ({
      gross: acc.gross + row.gross,
      commission: acc.commission + row.commission,
      net: acc.net + row.net,
    }),
    { gross: 0, commission: 0, net: 0 }
  )

  return (
    <div className="space-y-6">
      <AnalyticsRangeBar controls={controls} />

      {rows.isPending ? (
        <div className="bg-muted h-64 animate-pulse rounded-xl" aria-busy="true" />
      ) : rows.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {rows.error.message}
        </div>
      ) : (
        <Card className="py-0">
          <div className="overflow-x-auto">
            <Table className={cellPad}>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((row) => (
                  <TableRow key={`${row.month}:${row.propertyId}`}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell>{row.propertyName}</TableCell>
                    <TableCell className="text-right">{row.bookings}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.gross)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(row.rateBps / 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(row.commission)}
                    </TableCell>
                    <TableCell className="text-right">
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
                ) : (
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(total.gross)}
                    </TableCell>
                    <TableCell className="text-right">
                      {/*
                       * Recomputed from the money, not averaged from the rates.
                       *
                       * Averaging the per-row percentages weights a £200 month
                       * the same as a £20,000 one.
                       */}
                      {total.gross === 0
                        ? "—"
                        : `${((total.commission / total.gross) * 100).toFixed(2)}%`}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(total.commission)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(total.net)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <p className="text-muted-foreground text-sm">
        The rate shown is what each month actually achieved, weighted by booking
        value — not the rate on your organisation today. A commission voided by a
        goodwill refund counts as zero rather than disappearing from the month.
      </p>
    </div>
  )
}
