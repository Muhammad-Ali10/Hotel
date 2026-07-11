"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { cancellations } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatDate } from "@/lib/format"
import { StatusPill } from "@/components/extranet/shared"
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

const reasons = ["all", ...new Set(cancellations.map((c) => c.reason))]
const statuses = ["all", ...new Set(cancellations.map((c) => c.refundStatus))]

export function CancellationsTable() {
  const [query, setQuery] = React.useState("")
  const [reason, setReason] = React.useState("all")
  const [status, setStatus] = React.useState("all")

  const filtered = cancellations.filter((c) => {
    const q = query.trim().toLowerCase()
    const matchesQuery =
      !q ||
      c.guest.toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q) ||
      c.reason.toLowerCase().includes(q)
    const matchesReason = reason === "all" || c.reason === reason
    const matchesStatus = status === "all" || c.refundStatus === status
    return matchesQuery && matchesReason && matchesStatus
  })

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
        <Select value={reason} onValueChange={(v) => setReason(String(v))}>
          <SelectTrigger className="h-9 w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {reasons.map((r) => (
              <SelectItem key={r} value={r}>
                {r === "all" ? "All Reasons" : r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => setStatus(String(v))}>
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Reservation ID</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Original Dates</TableHead>
              <TableHead>Cancelled</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>By</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Refund</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.id}</TableCell>
                <TableCell>{c.guest}</TableCell>
                <TableCell>{c.room}</TableCell>
                <TableCell className="text-muted-foreground">
                  {c.originalDates}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(c.cancelledOn)}
                </TableCell>
                <TableCell>{c.reason}</TableCell>
                <TableCell>{c.by}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(c.total)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(c.refund)}
                </TableCell>
                <TableCell>
                  <StatusPill status={c.refundStatus} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-muted-foreground py-10 text-center"
                >
                  No cancellations match your filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      <p className="text-muted-foreground text-sm">
        Showing {filtered.length} of {cancellations.length} cancelled
        reservations
      </p>
    </div>
  )
}
