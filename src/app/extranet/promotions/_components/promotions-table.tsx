"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { toast } from "sonner"

import type { Stat } from "@/lib/extranet/types"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"
import { formatDiscount } from "@/lib/domain"
import { promotionStatusLabel, promotionStatusStyle } from "@/lib/labels"
import { useStore } from "@/store"
import { useHotels } from "@/store/selectors"
import { StatGrid } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Promotions are the only thing that puts a discount badge on the public site.
 * Toggling one here re-derives every affected listing — the badges used to be
 * hand-written strings in the catalogue that nothing could switch off.
 */
export function PromotionsStats() {
  const promotions = useStore((s) => s.promotions)
  const active = promotions.filter((p) => p.status === "active")

  const stats: Stat[] = [
    {
      label: "Total Revenue",
      value: formatCurrency(promotions.reduce((sum, p) => sum + p.revenue, 0)),
    },
    {
      label: "Total Bookings",
      value: formatNumber(promotions.reduce((sum, p) => sum + p.bookings, 0)),
    },
    {
      label: "Avg. Discount",
      value: active.length
        ? `${Math.round(
            active
              .filter((p) => p.discount.type === "percent")
              .reduce((sum, p, _, arr) => sum + p.discount.value / (arr.length || 1), 0)
          )}%`
        : "—",
    },
    { label: "Active Promos", value: String(active.length) },
  ]

  return <StatGrid stats={stats} />
}

export function PromotionsTable() {
  const promotions = useStore((s) => s.promotions)
  const setPromotionStatus = useStore((s) => s.setPromotionStatus)
  const hotels = useHotels()

  const hotelNames = (ids: string[]) =>
    ids
      .map((id) => hotels.find((h) => h.id === id)?.name)
      .filter(Boolean)
      .join(", ")

  return (
    <Card className="py-0">
      <div className="overflow-x-auto">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Promotion</TableHead>
              <TableHead>Discount</TableHead>
              <TableHead>Applies to</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead className="text-right">Bookings</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Live</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {promotions.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-muted-foreground text-xs">{p.id}</div>
                </TableCell>
                <TableCell className="font-medium">{formatDiscount(p.discount)}</TableCell>
                <TableCell className="text-muted-foreground max-w-56">
                  <span className="line-clamp-2">{hotelNames(p.hotelIds)}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(p.startDate)} → {formatDate(p.endDate)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {p.channel === "all" ? "Public site" : p.channel}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatNumber(p.bookings)}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(p.revenue)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={promotionStatusStyle[p.status]}>
                    {promotionStatusLabel[p.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={p.status === "active"}
                    onCheckedChange={(checked) => {
                      setPromotionStatus(p.id, checked ? "active" : "paused")
                      toast.success(
                        checked
                          ? `${p.name} is live — the discount now shows on your listings.`
                          : `${p.name} paused — the discount is off your listings.`
                      )
                    }}
                    aria-label={`${p.name} live`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}

export function PromotionsHint() {
  return (
    <p className="text-muted-foreground text-sm">
      Public-site promotions show as a badge and a struck-through rate on your listing, and
      are applied to the price at checkout.{" "}
      <Link
        href="/hotels"
        target="_blank"
        className="text-foreground inline-flex items-center gap-1 hover:underline"
      >
        See the marketplace <ExternalLink className="size-3" />
      </Link>
    </p>
  )
}
