"use client"

import * as React from "react"
import { MoreVertical, Search } from "lucide-react"
import { toast } from "sonner"

import type { Booking, BookingStatus } from "@/types"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatDate } from "@/lib/format"
import { guestName } from "@/lib/domain"
import { bookingStatusLabel } from "@/lib/labels"
import { useStore } from "@/store"
import { usePartnerReservations } from "@/store/selectors"
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
    ["confirmed", "pending", "checked_in", "checked_out", "completed"] as BookingStatus[]
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
  const reservations = usePartnerReservations()
  const [query, setQuery] = React.useState("")
  const [status, setStatus] = React.useState("all")
  const [source, setSource] = React.useState("all")
  const [date, setDate] = React.useState("")
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Booking | null>(null)
  const [cancelling, setCancelling] = React.useState<Booking | null>(null)

  const filtered = reservations.filter((r) => {
    const q = query.trim().toLowerCase()
    const matchesQuery =
      !q ||
      guestName(r).toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
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
                  <TableCell className="font-medium">{r.id}</TableCell>
                  <TableCell>
                    <div className="font-medium">{guestName(r)}</div>
                    <div className="text-muted-foreground text-xs">{r.guest.email}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.hotelName}</TableCell>
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
                  <TableCell className="text-center">{r.guests}</TableCell>
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

function DetailsDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const assignRoomNo = useStore((s) => s.assignRoomNo)
  const setBookingStatus = useStore((s) => s.setBookingStatus)
  const [roomNo, setRoomNo] = React.useState(booking.roomNo ?? "")

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{booking.id}</DialogTitle>
          <DialogDescription>
            {booking.hotelName} · booked {formatDate(booking.createdAt)}
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
          <Row label="Guests">{booking.guests}</Row>
          <Row label="Estimated arrival">{booking.arrivalTime}</Row>
          <Row label="Source">{booking.source}</Row>
          <Row label="Payment">
            {booking.payment.method === "card" ? "Card — paid" : "Pay at property"}
          </Row>
          {booking.addOns.length > 0 ? (
            <Row label="Extras">
              {booking.addOns.map((a) => `${a.name} (${formatCurrency(a.price * a.qty)})`).join(", ")}
            </Row>
          ) : null}
          {booking.specialRequests ? (
            <Row label="Guest requests">{booking.specialRequests}</Row>
          ) : null}
          {booking.notes ? <Row label="Internal note">{booking.notes}</Row> : null}
          <Row label="Total">{formatCurrency(booking.pricing.total)}</Row>
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
              onClick={() => {
                assignRoomNo(booking.id, roomNo)
                toast.success(`Room ${roomNo} assigned to ${booking.id}.`)
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
              onClick={() => {
                setBookingStatus(booking.id, "checked_in")
                toast.success(`${guestName(booking)} checked in.`)
                onClose()
              }}
            >
              Check in
            </Button>
          ) : null}
          {booking.status === "checked_in" ? (
            <Button
              variant="outline"
              onClick={() => {
                setBookingStatus(booking.id, "checked_out")
                toast.success(`${guestName(booking)} checked out.`)
                onClose()
              }}
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

function CancelDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const cancelBooking = useStore((s) => s.cancelBooking)
  const [reason, setReason] = React.useState("")

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel {booking.id}?</DialogTitle>
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
            onClick={() => {
              if (!reason.trim()) {
                toast.error("Please give a reason for the cancellation.")
                return
              }
              // Writes the cancellation to the shared booking — it now appears
              // on the Cancellations screen and in the guest's dashboard.
              cancelBooking(booking.id, reason.trim(), "hotel")
              toast.success(`${booking.id} cancelled.`)
              onClose()
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
