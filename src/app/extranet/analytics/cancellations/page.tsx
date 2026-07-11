import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { cancellationCharStats, cancellationReasons } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatNumber } from "@/lib/format"
import { PageHeader, StatGrid } from "@/components/extranet/shared"
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

export default function CancellationCharacteristicsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cancellation Characteristics"
        subtitle="Analyze why and when guests cancel their reservations"
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

      <StatGrid stats={cancellationCharStats} className="lg:grid-cols-4" />

      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Reason</TableHead>
              <TableHead className="text-right">Count</TableHead>
              <TableHead className="text-right">Share</TableHead>
              <TableHead className="text-right">Avg. Days Before</TableHead>
              <TableHead>Typical Refund</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cancellationReasons.map((r) => (
              <TableRow key={r.reason}>
                <TableCell className="font-medium">{r.reason}</TableCell>
                <TableCell className="text-right">
                  {formatNumber(r.count)}
                </TableCell>
                <TableCell className="text-right">{r.share}%</TableCell>
                <TableCell className="text-right">
                  {r.avgDaysBefore} days
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.typicalRefund}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
