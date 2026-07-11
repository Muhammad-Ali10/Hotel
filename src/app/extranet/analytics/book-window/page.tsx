import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { bookWindowRows } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatNumber } from "@/lib/format"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const maxShare = Math.max(...bookWindowRows.map((r) => r.share))

export default function BookWindowPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Book Window Info"
        subtitle="How far in advance guests are booking your rooms"
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

      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Booking Window</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="text-right">Share</TableHead>
              <TableHead className="text-right">Avg. Rate</TableHead>
              <TableHead className="text-right">Cancel Rate</TableHead>
              <TableHead className="w-40">Distribution</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookWindowRows.map((r) => (
              <TableRow key={r.window}>
                <TableCell className="font-medium">{r.window}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(r.bookings)}
                </TableCell>
                <TableCell className="text-right">{r.share}%</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(r.avgRate)}
                </TableCell>
                <TableCell className="text-right">{r.cancelRate}%</TableCell>
                <TableCell>
                  <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-foreground h-full rounded-full"
                      style={{ width: `${(r.share / maxShare) * 100}%` }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
