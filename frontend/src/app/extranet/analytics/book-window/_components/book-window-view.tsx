"use client"

import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import { useBookWindow } from "@/lib/api/hooks"
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
 * How far ahead people book, and what it is worth.
 *
 * The median lead time is deliberately not a mean. The distribution has two
 * humps — a same-week crowd and a months-ahead crowd — and their average is a
 * number describing nobody, sitting in the empty valley between them.
 *
 * The cancel rate per bucket is the column worth reading. A far-out booking is
 * revenue on the books for longer and also the one most likely to evaporate;
 * seeing both beside each other is what makes a minimum-advance rule (rule
 * #33) a decision rather than a guess.
 */
export function BookWindowView() {
  const { range, controls } = useAnalyticsRange(90)
  const data = useBookWindow(range)

  const buckets = data.data?.buckets ?? []
  const busiest = buckets.reduce<(typeof buckets)[number] | null>(
    (best, b) => (best === null || b.bookings > best.bookings ? b : best),
    null
  )

  return (
    <div className="space-y-6">
      <AnalyticsRangeBar controls={controls} />

      {data.isPending ? (
        <div className="bg-muted h-72 animate-pulse rounded-xl" aria-busy="true" />
      ) : data.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {data.error.message}
        </div>
      ) : (
        <>
          <SectionCard
            title="Typical lead time"
            description="The median, not the mean — the distribution has two humps and their average describes nobody."
          >
            <p className="font-heading text-3xl font-semibold">
              {data.data?.medianLeadDays === null || data.data === undefined
                ? "—"
                : `${data.data.medianLeadDays} ${
                    data.data.medianLeadDays === 1 ? "day" : "days"
                  }`}
            </p>
            {busiest && busiest.bookings > 0 ? (
              <p className="text-muted-foreground text-sm">
                Most bookings land in the {busiest.label.toLowerCase()} window.
              </p>
            ) : null}
          </SectionCard>

          <Card className="py-0">
            <div className="overflow-x-auto">
              <Table className={cellPad}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booked</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    <TableHead className="text-right">Average rate</TableHead>
                    <TableHead className="text-right">Later cancelled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {buckets.map((bucket) => (
                    <TableRow key={bucket.key}>
                      <TableCell className="font-medium">{bucket.label}</TableCell>
                      <TableCell className="text-right">{bucket.bookings}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                            <div
                              className="bg-foreground h-full rounded-full"
                              style={{ width: `${bucket.share * 100}%` }}
                            />
                          </div>
                          {(bucket.share * 100).toFixed(0)}%
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {money(bucket.avgRate, formatCurrency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(bucket.cancelRate * 100).toFixed(0)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
