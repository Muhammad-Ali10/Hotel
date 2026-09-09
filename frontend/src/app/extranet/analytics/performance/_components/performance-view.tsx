"use client"

import Link from "next/link"

import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import { usePerformance } from "@/lib/api/hooks"
import {
  AnalyticsRangeBar,
  money,
  useAnalyticsRange,
} from "@/components/extranet/analytics-range"
import { Badge } from "@/components/ui/badge"
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
 * How each property traded, by the night STAYED (rule #62).
 *
 * ADR, RevPAR and occupancy are computed on the server from `booking_nights`,
 * not worked out here from a list of bookings. That is the difference between
 * every screen quoting the same number and every screen quoting its own: a
 * booking spanning a month boundary contributes to both months, and only the
 * per-night ledger knows how much to each.
 *
 * A dash in the money columns is not a zero. A role that may not see revenue
 * gets `null` from the API rather than a rounded-down figure (rule #66).
 */
export function PerformanceView() {
  const { range, controls } = useAnalyticsRange(30)
  const rows = usePerformance(range)

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
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Room nights</TableHead>
                  <TableHead className="text-right">Occupancy</TableHead>
                  <TableHead className="text-right">ADR</TableHead>
                  <TableHead className="text-right">RevPAR</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Reviews</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows.data ?? []).map((row) => (
                  <TableRow key={row.propertyId}>
                    <TableCell className="font-medium">
                      <Link
                        href="/extranet/analytics/comparables"
                        className="hover:underline"
                      >
                        {row.property}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">
                      {row.roomNights}
                      <span className="text-muted-foreground">
                        {" "}
                        / {row.roomNightsAvailable}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {(row.occupancy * 100).toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {money(row.adr, formatCurrency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {money(row.revpar, formatCurrency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {money(row.revenue, formatCurrency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.score === null ? (
                        <span className="text-muted-foreground">never reviewed</span>
                      ) : (
                        <Badge variant="secondary">
                          {row.score.toFixed(1)} · {row.reviews}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(rows.data?.length ?? 0) === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                      No property traded in this window.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <p className="text-muted-foreground text-sm">
        Counted by the night stayed, so a booking spanning two months belongs to
        both. Sales Statistics counts the same bookings by the day they were made —
        the two will differ, and both are right.
      </p>
    </div>
  )
}
