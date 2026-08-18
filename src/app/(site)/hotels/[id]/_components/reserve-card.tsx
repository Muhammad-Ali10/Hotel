"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { AlertTriangle, CalendarDays, ShieldCheck, Users } from "lucide-react"

import type { Hotel } from "@/types"
import { formatCurrency } from "@/lib/format"
import {
  addDays,
  checkAvailability,
  formatDiscount,
  originalPrice,
  parseISODate,
  priceBooking,
  toISODate,
  unitsLeft,
} from "@/lib/domain"
import { useStore } from "@/store"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Party sizes the chosen room can actually sleep — `Room.guests` used to be
 *  printed on the room card and then ignored by the picker. */
function guestOptions(max: number) {
  return Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1).map((n) => ({
    value: String(n),
    label: `${n} ${n === 1 ? "Guest" : "Guests"}`,
  }))
}

type DateMatcher = Date | { before: Date }

/** ISO-string in, ISO-string out — the rest of the card speaks ISO. */
function DateField({
  label,
  value,
  disabled,
  onSelect,
}: {
  label: string
  value: string
  disabled: DateMatcher[]
  onSelect: (iso: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selected = parseISODate(value)

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full justify-start gap-2 font-normal"
            >
              <CalendarDays className="text-muted-foreground size-4" />
              {format(selected, "d MMM yyyy")}
            </Button>
          }
        />
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={disabled}
            onSelect={(date) => {
              if (date) onSelect(toISODate(date))
              setOpen(false)
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/**
 * The booking box. It carries the guest's dates, party size and chosen room
 * through to checkout — the old widget on this page could only fire a toast,
 * so nothing the guest picked here survived the click.
 */
export function ReserveCard({
  hotel,
  selectedRoomId,
  onSelectRoom,
}: {
  hotel: Hotel
  selectedRoomId?: string
  onSelectRoom?: (roomId: string) => void
}) {
  const router = useRouter()
  const bookings = useStore((s) => s.bookings)
  const tomorrow = React.useMemo(() => addDays(toISODate(new Date()), 1), [])

  const [checkIn, setCheckIn] = React.useState(tomorrow)
  const [checkOut, setCheckOut] = React.useState(() =>
    addDays(tomorrow, Math.max(hotel.availability.minStay, 2))
  )
  const [guests, setGuests] = React.useState("2")

  // Surfacing the partner's closed dates in the picker itself, so a guest can't
  // pick a night that `checkStay` would only reject afterwards.
  const today = React.useMemo(() => parseISODate(toISODate(new Date())), [])
  const closedDates = React.useMemo(
    () => hotel.availability.closedDates.map(parseISODate),
    [hotel.availability.closedDates]
  )

  const roomId = selectedRoomId ?? hotel.rooms[0]?.id ?? ""
  const room = hotel.rooms.find((r) => r.id === roomId) ?? hotel.rooms[0]
  const roomItems = hotel.rooms.map((r) => ({ value: r.id, label: r.name }))

  const guestItems = guestOptions(room?.guests ?? 2)
  // Clamped rather than corrected in an effect: switching from a suite to a
  // double must not carry a party of four across, and the repo forbids
  // setState-in-effect. `partySize` is the only guest count read from here on.
  const partySize = Math.min(Number(guests), room?.guests ?? Number(guests))

  const stay = checkAvailability({
    hotel,
    room,
    checkIn,
    checkOut,
    guests: partySize,
    bookings,
  })
  const remaining = unitsLeft(room, bookings, hotel.id, checkIn, checkOut)

  const pricing = React.useMemo(
    () =>
      stay.ok ? priceBooking({ hotel, room, checkIn, checkOut, guests: partySize }) : null,
    [hotel, room, checkIn, checkOut, partySize, stay.ok]
  )

  const strikethrough = originalPrice(hotel)
  const nightLabel = pricing?.nights === 1 ? "night" : "nights"

  function handleContinue() {
    const params = new URLSearchParams({
      hotel: hotel.id,
      room: room.id,
      checkin: checkIn,
      checkout: checkOut,
      guests: String(partySize),
    })
    router.push(`/checkout?${params.toString()}`)
  }

  return (
    <Card id="reserve" className="scroll-mt-24 lg:sticky lg:top-24">
      <CardContent className="space-y-4">
        {/* Price header */}
        <div className="flex items-end justify-between gap-2">
          <div>
            {strikethrough ? (
              <span className="text-muted-foreground mr-1 text-sm line-through">
                {formatCurrency(strikethrough)}
              </span>
            ) : null}
            <span className="font-heading text-2xl font-semibold">
              {formatCurrency(room.pricePerNight)}
            </span>
            <span className="text-muted-foreground text-sm"> / night</span>
          </div>
          {hotel.discount ? (
            <Badge className="gap-1">{formatDiscount(hotel.discount)}</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="size-3" />
              Best Price
            </Badge>
          )}
        </div>

        <Separator />

        {/* Dates — the same Calendar popover the header search uses. These were
            native date inputs, which render differently in every browser and
            let the guest type a date the property is closed on. */}
        <div className="grid grid-cols-2 gap-3">
          <DateField
            label="Check in"
            value={checkIn}
            disabled={[{ before: today }, ...closedDates]}
            onSelect={(iso) => {
              setCheckIn(iso)
              if (iso >= checkOut) setCheckOut(addDays(iso, hotel.availability.minStay || 1))
            }}
          />
          <DateField
            label="Check out"
            value={checkOut}
            disabled={[{ before: parseISODate(addDays(checkIn, 1)) }, ...closedDates]}
            onSelect={setCheckOut}
          />
        </div>

        {/* Availability — the property's calendar rules, the room's occupancy
            limit, and how many units are actually left to sell */}
        {!stay.ok ? (
          <p className="text-destructive flex items-start gap-1.5 text-sm">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {stay.message}
          </p>
        ) : remaining <= 3 ? (
          <p className="flex items-start gap-1.5 text-sm text-amber-600 dark:text-amber-500">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Only {remaining} {remaining === 1 ? "room" : "rooms"} left at this price.
          </p>
        ) : null}

        {/* Guests */}
        <div className="space-y-1.5">
          <Label>Guests</Label>
          <Select
            items={guestItems}
            value={String(partySize)}
            onValueChange={(v) => setGuests(v as string)}
          >
            <SelectTrigger className="h-9 w-full">
              <Users className="text-muted-foreground size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {guestItems.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Room type */}
        <div className="space-y-1.5">
          <Label>Room type</Label>
          <Select
            items={roomItems}
            value={roomId}
            onValueChange={(v) => onSelectRoom?.(v as string)}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {hotel.rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name} — {formatCurrency(r.pricePerNight)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Price breakdown — the same figures checkout and the invoice will use */}
        {pricing ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {formatCurrency(pricing.ratePerNight)} × {pricing.nights} {nightLabel}
              </span>
              <span className="font-medium">{formatCurrency(pricing.roomSubtotal)}</span>
            </div>
            {pricing.discount ? (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span>{pricing.discount.label}</span>
                <span className="font-medium">{formatCurrency(pricing.discount.amount)}</span>
              </div>
            ) : null}
            {pricing.taxes.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <span className="text-muted-foreground">{t.label}</span>
                <span className="font-medium">{formatCurrency(t.amount)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between text-base">
              <span className="font-heading font-semibold">Total</span>
              <span className="font-heading font-semibold">{formatCurrency(pricing.total)}</span>
            </div>
          </div>
        ) : null}

        <Button className="w-full" size="lg" onClick={handleContinue} disabled={!stay.ok}>
          {stay.ok ? "Reserve" : "Unavailable for these dates"}
        </Button>

        <div className="text-muted-foreground flex items-start gap-2 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            <span className="text-foreground font-medium">Free cancellation</span>
            <span className="block text-xs">{hotel.policies.cancellation}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
