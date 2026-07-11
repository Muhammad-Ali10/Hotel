import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { bookerSegments } from "@/data/extranet"
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

export default function BookerInsightsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Booker Insights"
        subtitle="Understand who is booking your properties and their behavior"
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
              <TableHead>Segment</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="text-right">Share</TableHead>
              <TableHead className="text-right">Avg. Spend</TableHead>
              <TableHead className="text-right">Avg. Stay</TableHead>
              <TableHead>Top Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bookerSegments.map((s) => (
              <TableRow key={s.segment}>
                <TableCell className="font-medium">{s.segment}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(s.bookings)}
                </TableCell>
                <TableCell className="text-right">{s.share}%</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(s.avgSpend)}
                </TableCell>
                <TableCell className="text-right">
                  {s.avgStay} nights
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {s.topSource}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
