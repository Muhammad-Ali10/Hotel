"use client"

import * as React from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"

import {
  addDays,
  checkAvailability,
  formatDiscount,
  priceBooking,
  toISODate,
} from "@/lib/domain"
import { formatCurrency } from "@/lib/format"
import { arrivalTimeSlots } from "@/data/config"
import { useStore } from "@/store"
import { usePartnerHotels } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Capped at what the selected room sleeps — the picker offered six regardless. */
function guestOptions(max: number) {
  return Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1).map((n) => ({
    value: String(n),
    label: String(n),
  }))
}

/**
 * Creates a real reservation for one of the partner's properties — a phone or
 * walk-in booking, priced through the same function the public checkout uses.
 *
 * The dialog used to list hardcoded property and room names that matched no
 * hotel in the catalogue, leave the guest and date inputs uncontrolled, and
 * toast "Reservation created" without writing anything.
 */
export function NewReservationDialog() {
  const hotels = usePartnerHotels()
  const createBooking = useStore((s) => s.createBooking)
  const setBookingStatus = useStore((s) => s.setBookingStatus)
  const bookings = useStore((s) => s.bookings)
  const [open, setOpen] = React.useState(false)

  const today = toISODate(new Date())
  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    hotelId: "",
    roomId: "",
    checkIn: addDays(today, 1),
    checkOut: addDays(today, 3),
    guests: "2",
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const hotel = hotels.find((h) => h.id === form.hotelId) ?? hotels[0]
  const room = hotel?.rooms.find((r) => r.id === form.roomId) ?? hotel?.rooms[0]

  const hotelItems = hotels.map((h) => ({ value: h.id, label: h.name }))
  const roomItems =
    hotel?.rooms.map((r) => ({
      value: r.id,
      label: `${r.name} — ${formatCurrency(r.pricePerNight)}`,
    })) ?? []

  const guestItems = guestOptions(room?.guests ?? 2)
  const partySize = Math.min(Number(form.guests), room?.guests ?? Number(form.guests))

  const stay =
    hotel && room
      ? checkAvailability({
          hotel,
          room,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          guests: partySize,
          bookings,
        })
      : null
  const pricing =
    hotel && room && stay?.ok
      ? priceBooking({
          hotel,
          room,
          checkIn: form.checkIn,
          checkOut: form.checkOut,
          guests: partySize,
        })
      : null

  function create() {
    if (!hotel || !room) return
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error("Enter the guest's name.")
      return
    }
    if (!/\S+@\S+\.\S+/.test(form.email)) {
      toast.error("Enter a valid email for the guest.")
      return
    }
    if (stay && !stay.ok) {
      toast.error(stay.message)
      return
    }

    // No `customerId`: a phone or walk-in booking has a guest but no platform
    // account behind it, and stamping one would file a stranger's stay under
    // the signed-in customer.
    const result = createBooking({
      hotelId: hotel.id,
      roomId: room.id,
      guest: {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        country: hotel.country,
      },
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      guests: partySize,
      arrivalTime: arrivalTimeSlots[0],
      specialRequests: "",
      addOns: [],
      payment: { method: "property", status: "pending" },
    })
    if (!result.ok) {
      toast.error("Couldn't create that reservation", { description: result.message })
      return
    }
    // Taken by the property, not through the site.
    setBookingStatus(result.data.id, "confirmed")

    toast.success(`${result.data.id} created for ${form.firstName} ${form.lastName}.`)
    setForm({ ...form, firstName: "", lastName: "", email: "", phone: "" })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            New Reservation
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New Reservation</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="res-first">First name *</Label>
              <Input
                id="res-first"
                value={form.firstName}
                onChange={(e) => set({ firstName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-last">Last name *</Label>
              <Input
                id="res-last"
                value={form.lastName}
                onChange={(e) => set({ lastName: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="res-email">Email *</Label>
              <Input
                id="res-email"
                type="email"
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-phone">Phone</Label>
              <Input
                id="res-phone"
                type="tel"
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Property</Label>
              <Select
                items={hotelItems}
                value={hotel?.id ?? ""}
                onValueChange={(v) => set({ hotelId: String(v), roomId: "" })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hotelItems.map((h) => (
                    <SelectItem key={h.value} value={h.value}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Select
                items={roomItems}
                value={room?.id ?? ""}
                onValueChange={(v) => set({ roomId: String(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roomItems.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="res-in">Check-in</Label>
              <Input
                id="res-in"
                type="date"
                value={form.checkIn}
                onChange={(e) => set({ checkIn: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="res-out">Check-out</Label>
              <Input
                id="res-out"
                type="date"
                value={form.checkOut}
                onChange={(e) => set({ checkOut: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Guests</Label>
              <Select
                items={guestItems}
                value={String(partySize)}
                onValueChange={(v) => set({ guests: String(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {guestItems.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {stay && !stay.ok ? (
            <p className="text-destructive text-sm">{stay.message}</p>
          ) : null}

          {pricing ? (
            <>
              <Separator />
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {formatCurrency(pricing.ratePerNight)} × {pricing.nights}{" "}
                    {pricing.nights === 1 ? "night" : "nights"}
                  </span>
                  <span className="font-medium">{formatCurrency(pricing.roomSubtotal)}</span>
                </div>
                {pricing.discount ? (
                  <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                    <span>{hotel?.discount ? formatDiscount(hotel.discount) : "Discount"}</span>
                    <span className="font-medium">
                      {formatCurrency(pricing.discount.amount)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Taxes &amp; charges</span>
                  <span className="font-medium">{formatCurrency(pricing.taxTotal)}</span>
                </div>
                <div className="flex items-center justify-between text-base">
                  <span className="font-heading font-semibold">Total</span>
                  <span className="font-heading font-semibold">
                    {formatCurrency(pricing.total)}
                  </span>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button onClick={create} disabled={Boolean(stay && !stay.ok)}>
            Create Reservation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
