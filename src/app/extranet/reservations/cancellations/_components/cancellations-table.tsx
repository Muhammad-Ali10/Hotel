"use client"

import * as React from "react"
import { Search } from "lucide-react"

import type { RefundStatus } from "@/types"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatDate } from "@/lib/format"
import { guestName } from "@/lib/domain"
import { refundStatusLabel } from "@/lib/labels"
import { usePartnerCancellations } from "@/store/selectors"
import { RefundBadge } from "@/components/shared/status-badge"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const refundItems = [
  { value: "all", label: "All refund states" },
  ...(["full", "partial", "none", "pending", "processed"] as RefundStatus[]).map((s) => ({
    value: s,
    label: refundStatusLabel[s],
  })),
]

const byItems = [
  { value: "all", label: "Cancelled by anyone" },
  { value: "guest", label: "Cancelled by guest" },
  { value: "hotel", label: "Cancelled by hotel" },
]

/**
 * Cancellations are bookings with `status: cancelled` — not a separate list.
 * A cancellation made in the dashboard or on the reservations screen lands here
 * on its own; the two used to be unrelated datasets that shared no ids.
 */
export function CancellationsTable() {
  const cancellations = usePartnerCancellations()
  const [query, setQuery] = React.useState("")
  const [by, setBy] = React.useState("all")
  const [status, setStatus] = React.useState("all")

  const filtered = cancellations.filter((c) => {
    const q = query.trim().toLowerCase()
    const matchesQuery =
      !q ||
      guestName(c).toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      (c.cancellation?.reason ?? "").toLowerCase().includes(q)
    const matchesBy = by === "all" || c.cancellation?.by === by
    const matchesStatus = status === "all" || c.cancellation?.refundStatus === status
    return matchesQuery && matchesBy && matchesStatus
  })

  const refunded = filtered.reduce((sum, c) => sum + (c.cancellation?.refund ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guest, reservation ID, reason…"
            className="h-9 pl-8"
          />
        </div>
        <Select items={byItems} value={by} onValueChange={(v) => setBy(String(v))}>
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {byItems.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={refundItems} value={status} onValueChange={(v) => setStatus(String(v))}>
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {refundItems.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        <div className="overflow-x-auto">
          <Table className={cellPad}>
            <TableHeader>
              <TableRow>
                <TableHead>Reservation ID</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Property</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Original dates</TableHead>
                <TableHead>Cancelled on</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>By</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Refund</TableHead>
                <TableHead>Refund status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.id}</TableCell>
                  <TableCell>
                    <div className="font-medium">{guestName(c)}</div>
                    <div className="text-muted-foreground text-xs">{c.guest.email}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.hotelName}</TableCell>
                  <TableCell>{c.roomName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(c.checkIn)} → {formatDate(c.checkOut)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.cancellation ? formatDate(c.cancellation.date) : "—"}
                  </TableCell>
                  <TableCell className="max-w-56">
                    <span className="line-clamp-2">{c.cancellation?.reason ?? "—"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {c.cancellation?.by ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(c.pricing.total)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(c.cancellation?.refund ?? 0)}
                  </TableCell>
                  <TableCell>
                    {c.cancellation ? <RefundBadge status={c.cancellation.refundStatus} /> : null}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground py-10 text-center">
                    No cancellations match these filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>

      <p className="text-muted-foreground text-sm">
        {filtered.length} {filtered.length === 1 ? "cancellation" : "cancellations"} ·{" "}
        {formatCurrency(refunded)} refunded
      </p>
    </div>
  )
}
