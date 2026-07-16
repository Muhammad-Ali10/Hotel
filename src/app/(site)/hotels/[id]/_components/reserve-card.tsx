"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, CalendarDays, ShieldCheck, Users } from "lucide-react"

import type { Hotel } from "@/types"
import { formatCurrency } from "@/lib/format"
import {
  addDays,
  checkStay,
  formatDiscount,
  originalPrice,
  priceBooking,
  toISODate,
} from "@/lib/domain"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const guestItems = [1, 2, 3, 4, 5, 6].map((n) => ({
  value: String(n),
  label: `${n} ${n === 1 ? "Guest" : "Guests"}`,
}))

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
  const tomorrow = React.useMemo(() => addDays(toISODate(new Date()), 1), [])

  const [checkIn, setCheckIn] = React.useState(tomorrow)
  const [checkOut, setCheckOut] = React.useState(() =>
    addDays(tomorrow, Math.max(hotel.availability.minStay, 2))
  )
  const [guests, setGuests] = React.useState("2")

  const roomId = selectedRoomId ?? hotel.rooms[0]?.id ?? ""
  const room = hotel.rooms.find((r) => r.id === roomId) ?? hotel.rooms[0]
  const roomItems = hotel.rooms.map((r) => ({ value: r.id, label: r.name }))

  const stay = checkStay(hotel.availability, checkIn, checkOut)
  const pricing = React.useMemo(
    () =>
      stay.ok
        ? priceBooking({ hotel, room, checkIn, checkOut, guests: Number(guests) })
        : null,
    [hotel, room, checkIn, checkOut, guests, stay.ok]
  )

  const strikethrough = originalPrice(hotel)
  const nightLabel = pricing?.nights === 1 ? "night" : "nights"

  function handleContinue() {
    const params = new URLSearchParams({
      hotel: hotel.id,
      room: room.id,
      checkin: checkIn,
      checkout: checkOut,
      guests,
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

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="check-in">Check in</Label>
            <div className="relative">
              <CalendarDays className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                id="check-in"
                type="date"
                value={checkIn}
                min={toISODate(new Date())}
                onChange={(e) => setCheckIn(e.target.value)}
                className="h-9 pl-8"
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
                min={addDays(checkIn, 1)}
                onChange={(e) => setCheckOut(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
          </div>
        </div>

        {/* Availability — the partner's open/close and min-stay rules */}
        {!stay.ok ? (
          <p className="text-destructive flex items-start gap-1.5 text-sm">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {stay.message}
          </p>
        ) : null}

        {/* Guests */}
        <div className="space-y-1.5">
          <Label>Guests</Label>
          <Select items={guestItems} value={guests} onValueChange={(v) => setGuests(v as string)}>
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
