"use client"

import * as React from "react"
import { MoreVertical, Search } from "lucide-react"
import { toast } from "sonner"

import type { Reservation } from "@/lib/extranet/types"
import { reservations } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatDate } from "@/lib/format"
import { StatusPill } from "@/components/extranet/shared"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const statuses = ["all", ...new Set(reservations.map((r) => r.status))]
const sources = ["all", ...new Set(reservations.map((r) => r.source))]
const PAGE_SIZE = 10

export function ReservationsTable() {
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [source, setSource] = React.useState("all")
  const [date, setDate] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Reservation | null>(null)
  const [cancelling, setCancelling] = React.useState<Reservation | null>(null)

  const filtered = reservations.filter((r) => {
    const q = query.trim().toLowerCase()
    const matchesQuery =
      !q ||
      r.guest.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.room.toLowerCase().includes(q)
    const matchesStatus = status === "all" || r.status === status
    const matchesSource = source === "all" || r.source === source
    const matchesDate = !date || r.checkIn === date
    return matchesQuery && matchesStatus && matchesSource && matchesDate
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const start = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const end = Math.min(currentPage * PAGE_SIZE, filtered.length)
  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
            placeholder="Search guest, reservation ID, room…"
            className="h-9 pl-8"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(String(v))
            setPage(1)
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All Statuses" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={source}
          onValueChange={(v) => {
            setSource(String(v))
            setPage(1)
          }}
        >
          <SelectTrigger className="h-9 w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "all" ? "All Sources" : s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            setPage(1)
          }}
          aria-label="Filter by check-in date"
          className="h-9 w-full sm:w-40"
        />
      </div>

      <Card className="py-0">
        <Table className={cellPad}>
          <TableHeader>
            <TableRow>
              <TableHead>Reservation ID</TableHead>
              <TableHead>Guest</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead className="text-center">Guests</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.id}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.guest}</div>
                  <div className="text-muted-foreground text-xs">{r.email}</div>
                </TableCell>
                <TableCell>
                  <div>{r.room}</div>
                  <div className="text-muted-foreground text-xs">
                    Room {r.roomNo}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(r.checkIn)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(r.checkOut)}
                </TableCell>
                <TableCell className="text-center">{r.guests}</TableCell>
                <TableCell>{r.source}</TableCell>
                <TableCell>
                  <StatusPill status={r.status} />
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(r.total)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Actions"
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => setSelected(r)}>
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => setCancelling(r)}
                      >
                        Cancel Booking
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-muted-foreground py-10 text-center"
                >
                  No reservations match your filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          Showing {start} – {end} of {filtered.length} results
        </p>
        {totalPages > 1 ? (
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <Button
                key={p}
                variant={p === currentPage ? "default" : "outline"}
                size="icon-sm"
                onClick={() => setPage(p)}
                aria-label={`Page ${p}`}
                aria-current={p === currentPage ? "page" : undefined}
              >
                {p}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      <ReservationDialog
        reservation={selected}
        onClose={() => setSelected(null)}
      />

      <CancelDialog
        key={cancelling?.id ?? "none"}
        reservation={cancelling}
        onClose={() => setCancelling(null)}
      />
    </div>
  )
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function ReservationDialog({
  reservation,
  onClose,
}: {
  reservation: Reservation | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!reservation} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {reservation ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <DialogTitle>Reservation Details</DialogTitle>
                <StatusPill status={reservation.status} />
              </div>
              <DialogDescription>{reservation.id}</DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <section className="space-y-3">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Guest Information
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Name" value={reservation.guest} />
                  <Field label="Email" value={reservation.email} />
                  <Field label="Guests" value={reservation.guests} />
                  <Field label="Source" value={reservation.source} />
                </div>
              </section>

              <section className="space-y-3 border-t pt-4">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Stay Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Property" value={reservation.property} />
                  <Field
                    label="Room"
                    value={`${reservation.room} (#${reservation.roomNo})`}
                  />
                  <Field
                    label="Check-in"
                    value={formatDate(reservation.checkIn)}
                  />
                  <Field
                    label="Check-out"
                    value={formatDate(reservation.checkOut)}
                  />
                </div>
              </section>

              <section className="space-y-3 border-t pt-4">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Payment
                </h3>
                <div className="flex items-end justify-between">
                  <div className="space-y-0.5">
                    <p className="text-muted-foreground text-xs">Total Amount</p>
                    <span className="font-heading text-2xl font-semibold">
                      {formatCurrency(reservation.total)}
                    </span>
                  </div>
                  <span className="text-muted-foreground text-xs">
                    Created {formatDate(reservation.createdAt)}
                  </span>
                </div>
              </section>

              <section className="space-y-2 border-t pt-4">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  Notes
                </h3>
                <p className="text-muted-foreground text-sm">
                  {reservation.notes}
                </p>
              </section>
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Close
              </DialogClose>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({
  reservation,
  onClose,
}: {
  reservation: Reservation | null
  onClose: () => void
}) {
  // Fresh state per target: the parent remounts this via `key`.
  const [reason, setReason] = React.useState("")

  return (
    <Dialog open={!!reservation} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {reservation ? (
          <>
            <DialogHeader>
              <DialogTitle>Cancel Booking</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel reservation {reservation.id} for{" "}
                {reservation.guest}?
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor="cancellation-reason">Cancellation Reason</Label>
              <Textarea
                id="cancellation-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter the reason for cancellation…"
                rows={3}
              />
            </div>

            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Keep Reservation
              </DialogClose>
              <Button
                variant="destructive"
                disabled={!reason.trim()}
                onClick={() => {
                  toast.success(`Reservation ${reservation.id} cancelled`)
                  onClose()
                }}
              >
                Confirm Cancellation
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
