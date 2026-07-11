import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { performanceRows } from "@/data/extranet"
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

export default function PerformancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Dashboard"
        subtitle="Per-property performance breakdown"
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
              <TableHead>Property</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="text-right">ADR</TableHead>
              <TableHead className="text-right">Occ.</TableHead>
              <TableHead className="text-right">RevPAR</TableHead>
              <TableHead className="text-right">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {performanceRows.map((p) => (
              <TableRow key={p.property}>
                <TableCell className="font-medium">{p.property}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(p.revenue)}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(p.bookings)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(p.adr)}
                </TableCell>
                <TableCell className="text-right">{p.occupancy}%</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(p.revpar)}
                </TableCell>
                <TableCell className="text-right">
                  {p.score.toFixed(1)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
