import type { Stat } from "@/lib/extranet/types"
import { promotions, promotionStats } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatNumber } from "@/lib/format"
import { PageHeader, StatGrid, StatusPill } from "@/components/extranet/shared"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PromotionsNav } from "./_components/promotions-nav"
import { CreatePromotionDialog } from "./_components/create-promotion-dialog"

const stats: Stat[] = [
  { label: "Total Revenue", value: formatCurrency(promotionStats.totalRevenue) },
  { label: "Total Bookings", value: formatNumber(promotionStats.totalBookings) },
  { label: "Avg. Discount", value: promotionStats.avgDiscount },
  { label: "Active Promos", value: String(promotionStats.active) },
]

export default function PromotionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Active Promotions"
        subtitle={`${promotions.length} promotions · ${promotionStats.active} active`}
      >
        <CreatePromotionDialog />
      </PageHeader>

      <PromotionsNav />

      <StatGrid stats={stats} />

      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Promotion</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Room Types</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-muted-foreground text-xs">{p.id}</div>
                </TableCell>
                <TableCell>{p.discount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {p.period}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {p.roomTypes}
                </TableCell>
                <TableCell className="text-right">
                  {formatNumber(p.bookings)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(p.revenue)}
                </TableCell>
                <TableCell>
                  <StatusPill status={p.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
