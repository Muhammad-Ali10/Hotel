"use client"

import * as React from "react"
import { MoreVertical, Search } from "lucide-react"
import { toast } from "sonner"

import type { BookingStatus } from "@/types"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatDate } from "@/lib/format"
import { guestName } from "@/lib/domain"
import { bookingStatusLabel } from "@/lib/labels"
import type { BookingDto } from "@/lib/api/endpoints"
import { usePartnerBookingActions, usePartnerBookings } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { StatusBadge } from "@/components/shared/status-badge"
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

const PAGE_SIZE = 10

const statusItems = [
  { value: "all", label: "All Statuses" },
  ...(
    ["confirmed", "pending", "checked_in", "completed", "completed"] as BookingStatus[]
  ).map((s) => ({ value: s, label: bookingStatusLabel[s] })),
]

const sourceItems = [
  { value: "all", label: "All Sources" },
  ...["Direct", "Booking.com", "Expedia", "Travel Agency"].map((s) => ({
    value: s,
    label: s,
  })),
]

/**
 * The partner's reservation list — the same bookings the guests made on the
 * public site, not a parallel dataset. A booking taken through checkout shows
 * up here, and a cancellation here reaches the guest's dashboard.
 */
export function ReservationsTable() {
  const { active } = useActiveProperty()
  const { data, isPending, error } = usePartnerBookings()

  /*
   * Narrowed to the property the topbar has selected.
   *
   * The API returns every booking this member may see across the whole
   * portfolio, which is right — a manager with three hotels wants one place to
   * look. The screen narrows it because the rest of the extranet is about ONE
   * property at a time.
   */
  const reservations = React.useMemo(
    () => (data ?? []).filter((b) => !active || b.propertyId === active.id),
    [data, active]
  )
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [source, setSource] = React.useState("all")
  const [date, setDate] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<BookingDto | null>(null)
  const [cancelling, setCancelling] = React.useState<BookingDto | null>(null)

  const filtered = reservations.filter((r) => {
    const q = query.trim().toLowerCase()
    const matchesQuery =
      !q ||
      guestName(r).toLowerCase().includes(q) ||
      r.ref.toLowerCase().includes(q) ||
      r.roomName.toLowerCase().includes(q)
    const matchesStatus = status === "all" || r.status === status
    const matchesSource = source === "all" || r.source === source
    const matchesDate = !date || r.checkIn === date
    return matchesQuery && matchesStatus && matchesSource && matchesDate
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const start = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const end = Math.min(currentPage * PAGE_SIZE, filtered.length)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading reservations">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-14 animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {error.message}
      </div>
    )
  }

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
          items={statusItems}
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
            {statusItems.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={sourceItems}
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
            {sourceItems.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
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
        <div className="overflow-x-auto">
          <Table className={cellPad}>
            <TableHeader>
              <TableRow>
                <TableHead>Reservation ID</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Property</TableHead>
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
                  <TableCell className="font-medium">{r.ref}</TableCell>
                  <TableCell>
                    <div className="font-medium">{guestName(r)}</div>
                    <div className="text-muted-foreground text-xs">{r.guest.email}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.propertyName}</TableCell>
                  <TableCell>
                    <div>{r.roomName}</div>
                    {r.roomNo ? (
                      <div className="text-muted-foreground text-xs">Room {r.roomNo}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.checkIn)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(r.checkOut)}
                  </TableCell>
                  <TableCell className="text-center">{r.adults + r.children}</TableCell>
                  <TableCell>{r.source}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(r.pricing.total)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" aria-label="Actions">
                            <MoreVertical className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => setSelected(r)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem variant="destructive" onClick={() => setCancelling(r)}>
                          Cancel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-muted-foreground py-10 text-center">
                    No reservations match these filters.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Showing {start}–{end} of {filtered.length}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {selected ? (
        <DetailsDialog booking={selected} onClose={() => setSelected(null)} />
      ) : null}
      {cancelling ? (
        <CancelDialog booking={cancelling} onClose={() => setCancelling(null)} />
      ) : null}
    </div>
  )
}

function DetailsDialog({ booking, onClose }: { booking: BookingDto; onClose: () => void }) {
  const { setStatus } = usePartnerBookingActions()
  const [roomNo, setRoomNo] = React.useState(booking.roomNo ?? "")

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{booking.ref}</DialogTitle>
          <DialogDescription>
            {booking.propertyName} · booked {formatDate(booking.createdAt)}
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-3 text-sm">
          <Row label="Guest">{guestName(booking)}</Row>
          <Row label="Email">{booking.guest.email}</Row>
          {/* Checkout collects a phone number and a country; this panel used to
              show neither, while showing a room number nobody had entered. */}
          <Row label="Phone">{booking.guest.phone}</Row>
          <Row label="Country">{booking.guest.country}</Row>
          <Row label="Room">{booking.roomName}</Row>
          <Row label="Stay">
            {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)} (
            {booking.pricing.nights} nights)
          </Row>
          <Row label="Guests">{booking.adults + booking.children}</Row>
          <Row label="Estimated arrival">{booking.arrivalTime || "—"}</Row>
          <Row label="Source">{booking.source}</Row>
          <Row label="Payment">
            {/*
              The MODE, which is what the booking carries (rule #42). Whether
              the money moved lives in the payments ledger, and a copy here
              would be a second answer free to disagree with it.
            */}
            {booking.payment.mode === "prepay" ? "Prepaid" : "Pay at property"}
          </Row>
          {booking.specialRequests ? (
            <Row label="Guest requests">{booking.specialRequests}</Row>
          ) : null}
          <Row label="Total">{formatCurrency(booking.total)}</Row>
        </dl>

        <div className="space-y-1.5">
          <Label htmlFor="room-no">Assign room number</Label>
          <div className="flex gap-2">
            <Input
              id="room-no"
              value={roomNo}
              onChange={(e) => setRoomNo(e.target.value)}
              placeholder="e.g. 1204"
              className="h-9"
            />
            <Button
              size="sm"
              disabled={setStatus.isPending}
              onClick={() => {
                /*
                 * A room number rides along with a state change, because that
                 * is when a property assigns one. There is no endpoint that
                 * sets it alone, and inventing one would be a second way to
                 * write the same column.
                 */
                setStatus.mutate(
                  { id: booking.id, status: booking.status, roomNo },
                  {
                    onSuccess: () => toast.success(`Room ${roomNo} assigned to ${booking.ref}.`),
                    onError: (e) => toast.error(e.message),
                  }
                )
              }}
            >
              Save
            </Button>
          </div>
        </div>

        <DialogFooter>
          {booking.status === "confirmed" ? (
            <Button
              variant="outline"
              onClick={() =>
                setStatus.mutate(
                  { id: booking.id, status: "checked_in", ...(roomNo ? { roomNo } : {}) },
                  {
                    onSuccess: () => {
                      toast.success(`${guestName(booking)} checked in.`)
                      onClose()
                    },
                    onError: (e) => toast.error(e.message),
                  }
                )
              }
            >
              Check in
            </Button>
          ) : null}
          {booking.status === "checked_in" ? (
            <Button
              variant="outline"
              onClick={() =>
                setStatus.mutate(
                  { id: booking.id, status: "completed" },
                  {
                    onSuccess: () => {
                      toast.success(`${guestName(booking)} checked out.`)
                      onClose()
                    },
                    onError: (e) => toast.error(e.message),
                  }
                )
              }
            >
              Check out
            </Button>
          ) : null}
          <DialogClose render={<Button>Close</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CancelDialog({ booking, onClose }: { booking: BookingDto; onClose: () => void }) {
  const { cancel } = usePartnerBookingActions()
  const [reason, setReason] = React.useState("")

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel {booking.ref}?</DialogTitle>
          <DialogDescription>
            {guestName(booking)} will be notified and refunded under the property&apos;s
            cancellation policy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why is the property cancelling this reservation?"
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Keep reservation</Button>} />
          <Button
            variant="destructive"
            disabled={cancel.isPending}
            onClick={() => {
              if (!reason.trim()) {
                toast.error("Please give a reason for the cancellation.")
                return
              }
              /*
               * One booking, not two datasets. This reaches the guest's own
               * dashboard — and the refund follows THEIR terms rather than the
               * property's convenience: a cancellation the guest did not cause
               * carries no penalty (rule #37).
               */
              cancel.mutate(
                { id: booking.id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success(`${booking.ref} cancelled.`)
                    onClose()
                  },
                  onError: (e) => toast.error(e.message),
                }
              )
            }}
          >
            Confirm cancellation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right font-medium">{children}</dd>
    </div>
  )
}
