"use client"

import type { SeriesPoint } from "@/lib/extranet/types"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import { usePace } from "@/lib/api/hooks"
import { BarChart } from "@/components/extranet/charts/bar-chart"
import {
  AnalyticsRangeBar,
  money,
  useAnalyticsRange,
} from "@/components/extranet/analytics-range"
import { SectionCard } from "@/components/extranet/shared"
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
 * What has already been stayed, and what is on the books ahead.
 *
 * The comparison in the second table is the one that has to be right, and the
 * one most pace reports get wrong: `lastYear` is what was ALREADY BOOKED by
 * this day a year ago — not what that year eventually became. Comparing
 * today's partial book against last year's finished one shows every property
 * collapsing, every year, forever.
 */
export function PaceView() {
  const { range, granularity, controls } = useAnalyticsRange(90)
  const pace = usePace({ ...range, granularity })

  const completed = pace.data?.completed ?? []
  const future = pace.data?.future ?? []

  const series: SeriesPoint[] = future.map((row) => ({
    label: row.period,
    value: row.bookedNow,
    secondary: row.lastYear,
  }))

  return (
    <div className="space-y-6">
      <AnalyticsRangeBar controls={controls} showGranularity />

      {pace.isPending ? (
        <div className="bg-muted h-72 animate-pulse rounded-xl" aria-busy="true" />
      ) : pace.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {pace.error.message}
        </div>
      ) : (
        <>
          <SectionCard
            title="On the books ahead"
            description="Room nights booked for future stay dates, against the same point last year."
          >
            {series.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nothing on the books for the dates in this window.
              </p>
            ) : (
              <BarChart
                data={series}
                showLine
                legendPrimary="Booked now"
                legendSecondary="Same point last year"
              />
            )}
          </SectionCard>

          <div className="space-y-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Already stayed
            </h2>
            <Card className="py-0">
              <div className="overflow-x-auto">
                <Table className={cellPad}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Room nights</TableHead>
                      <TableHead className="text-right">Occupancy</TableHead>
                      <TableHead className="text-right">ADR</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completed.map((row) => (
                      <TableRow key={row.period}>
                        <TableCell className="font-medium">{row.period}</TableCell>
                        <TableCell className="text-right">{row.bookings}</TableCell>
                        <TableCell className="text-right">{row.roomNights}</TableCell>
                        <TableCell className="text-right">
                          {(row.occupancy * 100).toFixed(0)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {money(row.adr, formatCurrency)}
                        </TableCell>
                        <TableCell className="text-right">
                          {money(row.revenue, formatCurrency)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {completed.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-muted-foreground py-8 text-center"
                        >
                          No night inside this window has been stayed yet.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>

          <div className="space-y-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Still to come
            </h2>
            <Card className="py-0">
              <div className="overflow-x-auto">
                <Table className={cellPad}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Booked now</TableHead>
                      <TableHead className="text-right">This point last year</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {future.map((row) => {
                      const diff = row.bookedNow - row.lastYear
                      return (
                        <TableRow key={row.period}>
                          <TableCell className="font-medium">{row.period}</TableCell>
                          <TableCell className="text-right">{row.bookedNow}</TableCell>
                          <TableCell className="text-right">{row.lastYear}</TableCell>
                          <TableCell className="text-right">
                            {diff === 0 ? "—" : `${diff > 0 ? "+" : ""}${diff}`}
                          </TableCell>
                          <TableCell className="text-right">
                            {money(row.revenue, formatCurrency)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {future.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-muted-foreground py-8 text-center"
                        >
                          Nothing booked for future nights in this window.
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
