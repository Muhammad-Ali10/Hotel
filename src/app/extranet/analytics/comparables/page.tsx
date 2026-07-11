import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { comparableProperties } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
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

function You({ value, better }: { value: string; better: boolean }) {
  return (
    <span
      className={cn(
        "font-medium",
        better ? "text-emerald-600 dark:text-emerald-400" : ""
      )}
    >
      {value}
    </span>
  )
}

export default function ComparablePropertiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Comparable Properties"
        subtitle="Benchmark your performance against similar properties in your market"
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
              <TableHead className="text-right">Your ADR</TableHead>
              <TableHead className="text-right">Market ADR</TableHead>
              <TableHead className="text-right">Your Occ.</TableHead>
              <TableHead className="text-right">Market Occ.</TableHead>
              <TableHead className="text-right">Your Score</TableHead>
              <TableHead className="text-right">Market Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comparableProperties.map((p) => (
              <TableRow key={p.property}>
                <TableCell className="font-medium">{p.property}</TableCell>
                <TableCell className="text-right">
                  <You
                    value={formatCurrency(p.yourAdr)}
                    better={p.yourAdr >= p.marketAdr}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {formatCurrency(p.marketAdr)}
                </TableCell>
                <TableCell className="text-right">
                  <You
                    value={`${p.yourOcc}%`}
                    better={p.yourOcc >= p.marketOcc}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {p.marketOcc}%
                </TableCell>
                <TableCell className="text-right">
                  <You
                    value={p.yourScore.toFixed(1)}
                    better={p.yourScore >= p.marketScore}
                  />
                </TableCell>
                <TableCell className="text-muted-foreground text-right">
                  {p.marketScore.toFixed(1)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
