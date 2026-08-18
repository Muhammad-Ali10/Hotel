"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, CalendarDays, MapPin, Users } from "lucide-react"
import { toast } from "sonner"

import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatDate } from "@/lib/format"
import { checkAvailability, priceBooking } from "@/lib/domain"
import { useStore } from "@/store"
import { useBooking, useHotel } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/status-badge"
import { NotFoundCard } from "@/components/shared/not-found-card"

/** Party sizes the room can actually sleep — `Room.guests` was display-only. */
function guestOptions(max: number) {
  return Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1).map((n) => ({
    value: String(n),
    label: `${n} ${n === 1 ? "Guest" : "Guests"}`,
  }))
}

export function ModifyBooking({ id }: { id: string }) {
  const router = useRouter()
  const booking = useBooking(id)
  const hotel = useHotel(booking?.hotelId ?? "")
  const modifyBooking = useStore((s) => s.modifyBooking)
  const bookings = useStore((s) => s.bookings)

  const [checkIn, setCheckIn] = React.useState(booking?.checkIn ?? "")
  const [checkOut, setCheckOut] = React.useState(booking?.checkOut ?? "")
  const [guests, setGuests] = React.useState(String(booking?.guests ?? 2))
  const [requests, setRequests] = React.useState(booking?.specialRequests ?? "")

  if (!booking || !hotel) {
    return (
      <NotFoundCard
        title="Booking not found"
        description="We couldn't find a reservation with that reference."
        href="/dashboard/bookings"
        cta="Back to My Bookings"
      />
    )
  }

  if (booking.status === "cancelled") {
    return (
      <NotFoundCard
        title="This booking was cancelled"
        description="Cancelled reservations can no longer be modified."
        href="/dashboard/bookings"
        cta="Back to My Bookings"
      />
    )
  }

  const room = hotel.rooms.find((r) => r.id === booking.roomId)
  const guestChoices = guestOptions(room?.guests ?? booking.guests)
  // Excludes this reservation from the inventory count — it already holds its
  // own room, so it must not be allowed to block itself.
  const stay = room
    ? checkAvailability({
        hotel,
        room,
        checkIn,
        checkOut,
        guests: Number(guests),
        bookings,
        ignoreBookingId: booking.id,
      })
    : ({ ok: false, reason: "invalid", message: "That room is no longer offered." } as const)
  const validDates = stay.ok

  // Re-priced with the same function that quoted the original booking, so the
  // difference shown here is the difference the guest will actually be charged.
  const newPricing =
    validDates && room
      ? priceBooking({
          hotel,
          room,
          checkIn,
          checkOut,
          guests: Number(guests),
          addOns: booking.addOns,
        })
      : null

  const diff = newPricing ? newPricing.total - booking.pricing.total : 0

  const changed =
    checkIn !== booking.checkIn ||
    checkOut !== booking.checkOut ||
    guests !== String(booking.guests) ||
    requests.trim() !== booking.specialRequests.trim()

  function handleSave() {
    if (!stay.ok) {
      toast.error(stay.message)
      return
    }
    if (!changed) {
      toast.info("No changes to save.")
      return
    }
    const result = modifyBooking(id, {
      checkIn,
      checkOut,
      guests: Number(guests),
      specialRequests: requests.trim(),
    })
    if (!result.ok) {
      toast.error("We couldn't save that change", { description: result.message })
      return
    }
    toast.success(`Your booking at ${booking!.hotelName} has been updated.`)
    router.push("/dashboard/bookings")
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={
            <Link href="/dashboard/bookings">
              <ArrowLeft className="size-4" />
              Back to My Bookings
            </Link>
          }
        />
        <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Modify Booking
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Update your stay details. Any price difference is shown on the right.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* LEFT — editable details */}
        <div className="space-y-6">
          <Card className="overflow-hidden pt-0">
            <div className="flex flex-col sm:flex-row">
              <div className="relative h-40 w-full shrink-0 overflow-hidden sm:h-auto sm:w-44">
                <Image
                  src={placeholderImage(booking.seed, 400, 300)}
                  alt={booking.hotelName}
                  fill
                  sizes="(max-width: 640px) 100vw, 176px"
                  className="object-cover"
                />
              </div>
              <CardContent className="min-w-0 flex-1 py-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-semibold">
                      {booking.hotelName}
                    </h2>
                    <p className="text-muted-foreground text-sm">{booking.roomName}</p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {booking.id}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="text-muted-foreground mt-3 flex items-center gap-1 text-sm">
                  <MapPin className="size-3.5" />
                  {booking.city}
                </p>
              </CardContent>
            </div>
          </Card>

          <Card>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="check-in">Check in</Label>
                  <div className="relative">
                    <CalendarDays className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                    <Input
                      id="check-in"
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="check-out">Check out</Label>
                  <div className="relative">
                    <CalendarDays className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                    <Input
                      id="check-out"
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>

              {!stay.ok ? (
                <p className="text-destructive flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="size-3.5" />
                  {stay.message}
                </p>
              ) : null}

              <div className="space-y-1.5">
                <Label>Guests</Label>
                <Select
                  items={guestChoices}
                  value={guests}
                  onValueChange={(v) => setGuests(v as string)}
                >
                  <SelectTrigger className="w-full">
                    <Users className="text-muted-foreground size-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {guestChoices.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="requests">Special requests (optional)</Label>
                <Textarea
                  id="requests"
                  value={requests}
                  onChange={(e) => setRequests(e.target.value)}
                  placeholder="Early check-in, room preference…"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — price change + actions */}
        <div>
          <Card className="lg:sticky lg:top-24">
            <CardContent className="space-y-4">
              <h3 className="font-heading font-semibold">Updated Summary</h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">New dates</span>
                  <span className="text-right font-medium">
                    {formatDate(checkIn)} → {formatDate(checkOut)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nights</span>
                  <span className="font-medium">{newPricing?.nights ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Guests</span>
                  <span className="font-medium">{guests}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Original total</span>
                  <span className="font-medium">
                    {formatCurrency(booking.pricing.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-base">
                  <span className="font-heading font-semibold">New total</span>
                  <span className="font-heading font-semibold">
                    {newPricing ? formatCurrency(newPricing.total) : "—"}
                  </span>
                </div>
              </div>

              {newPricing ? (
                <div
                  className={
                    diff === 0
                      ? "bg-muted/50 text-muted-foreground rounded-lg border px-3 py-2.5 text-sm"
                      : diff > 0
                        ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
                        : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
                  }
                >
                  {diff === 0
                    ? "No price change."
                    : diff > 0
                      ? `Additional payment of ${formatCurrency(diff)} required.`
                      : `You'll be refunded ${formatCurrency(-diff)}.`}
                </div>
              ) : null}

              <Button size="lg" className="w-full" onClick={handleSave} disabled={!validDates}>
                Save Changes
              </Button>
              <Button
                variant="outline"
                className="w-full"
                render={<Link href="/dashboard/bookings">Discard</Link>}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
