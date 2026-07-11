import Link from "next/link"
import { ChevronLeft, Minus, TrendingDown, TrendingUp } from "lucide-react"

import { rankingRows } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatNumber } from "@/lib/format"
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

const sorted = [...rankingRows].sort((a, b) => a.rank - b.rank)

function Trend({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up")
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="size-4" />
        Up
      </span>
    )
  if (trend === "down")
    return (
      <span className="text-destructive inline-flex items-center gap-1">
        <TrendingDown className="size-4" />
        Down
      </span>
    )
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1">
      <Minus className="size-4" />
      Flat
    </span>
  )
}

export default function RankingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Ranking Dashboard"
        subtitle="Your property rankings within each city market"
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
              <TableHead>Rank</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Reviews</TableHead>
              <TableHead className="text-right">Conversion</TableHead>
              <TableHead>Trend</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.property}>
                <TableCell className="font-heading text-base font-semibold">
                  #{r.rank}
                </TableCell>
                <TableCell className="font-medium">{r.property}</TableCell>
                <TableCell className="text-muted-foreground">{r.city}</TableCell>
                <TableCell className="text-right">
                  {r.score.toFixed(1)}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(r.reviews)}
                </TableCell>
                <TableCell className="text-right">{r.conversion}%</TableCell>
                <TableCell>
                  <Trend trend={r.trend} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
