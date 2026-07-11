import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { paceCompleted, paceFuture } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatNumber } from "@/lib/format"
import {
  DeltaBadge,
  PageHeader,
  SectionCard,
} from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export default function PaceOfBookingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Pace of Bookings"
        subtitle="Track booking velocity vs historical performance"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/analytics" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <SectionCard title="Completed Bookings" contentClassName="px-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">ADR</TableHead>
              <TableHead className="text-right">Occ.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paceCompleted.map((r) => (
              <TableRow key={r.period}>
                <TableCell className="font-medium">{r.period}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(r.bookings)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(r.revenue)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(r.adr)}
                </TableCell>
                <TableCell className="text-right">{r.occupancy}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard
        title="Future Booking Pace"
        description="Bookings on the books vs the same point last year"
        contentClassName="px-0"
      >
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Booked Now</TableHead>
              <TableHead className="text-right">Last Year</TableHead>
              <TableHead className="text-right">vs LY</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paceFuture.map((r) => {
              const pct = Math.round(
                ((r.bookedNow - r.lastYear) / r.lastYear) * 100
              )
              return (
                <TableRow key={r.period}>
                  <TableCell className="font-medium">{r.period}</TableCell>
                  <TableCell className="text-right">{r.bookedNow}</TableCell>
                  <TableCell className="text-muted-foreground text-right">
                    {r.lastYear}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeltaBadge
                      delta={`${pct > 0 ? "+" : ""}${pct}%`}
                      trend={pct > 0 ? "up" : pct < 0 ? "down" : "flat"}
                      className="justify-end"
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  )
}
