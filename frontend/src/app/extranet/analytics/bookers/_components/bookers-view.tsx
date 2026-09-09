"use client"

import type { BookerSegmentView } from "@stayora/shared"

import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import { useBookers } from "@/lib/api/hooks"
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
 * Who books, cut three ways.
 *
 * All three cuts answer the same range over the same bookings, so their totals
 * agree by construction — which is exactly what a screen assembling them from
 * three separate fixtures could not promise.
 *
 * The repeat rate is guests with more than one booking over guests with any.
 * It is not a loyalty score and it is not a percentage of bookings; a single
 * guest who books eleven times moves it by one guest, not by eleven bookings.
 */
export function BookersView() {
  const { range, controls } = useAnalyticsRange(365)
  const data = useBookers(range)

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
            title="Repeat guests"
            description="Guests who booked more than once, over guests who booked at all."
          >
            <p className="font-heading text-3xl font-semibold">
              {((data.data?.repeatRate ?? 0) * 100).toFixed(1)}%
            </p>
          </SectionCard>

          <SegmentTable
            title="By country"
            caption="Where the guest's account says they are."
            rows={data.data?.byCountry ?? []}
          />
          <SegmentTable
            title="By party"
            caption="Adults and children as booked, not as they turned up."
            rows={data.data?.byParty ?? []}
          />
          <SegmentTable
            title="By source"
            caption="Where the booking came from."
            rows={data.data?.bySource ?? []}
          />
        </>
      )}
    </div>
  )
}

function SegmentTable({
  title,
  caption,
  rows,
}: {
  title: string
  caption: string
  rows: BookerSegmentView[]
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground text-sm">{caption}</p>
      </div>
      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table className={cellPad}>
            <TableHeader>
              <TableRow>
                <TableHead>Segment</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Share</TableHead>
                <TableHead className="text-right">Average spend</TableHead>
                <TableHead className="text-right">Average stay</TableHead>
                <TableHead>Top source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.segment}>
                  <TableCell className="font-medium">{row.segment}</TableCell>
                  <TableCell className="text-right">{row.bookings}</TableCell>
                  <TableCell className="text-right">
                    {(row.share * 100).toFixed(0)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {money(row.avgSpend, formatCurrency)}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.avgStay.toFixed(1)} nights
                  </TableCell>
                  <TableCell className="text-muted-foreground">{row.topSource}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    Nothing booked in this window.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  )
}
