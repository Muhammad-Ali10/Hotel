"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, MessageCircle, ShieldCheck, Users } from "lucide-react"
import { toast } from "sonner"

import type { Hotel } from "@/types"
import { formatCurrency } from "@/lib/format"
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

const guestOptions = [
  { value: "1-1", label: "1 Guest, 1 Room" },
  { value: "2-1", label: "2 Guests, 1 Room" },
  { value: "3-1", label: "3 Guests, 1 Room" },
  { value: "4-2", label: "4 Guests, 2 Rooms" },
]

const TAX_RATE = 0.12

export function ReserveCard({ hotel }: { hotel: Hotel }) {
  const router = useRouter()
  const [checkIn, setCheckIn] = React.useState("2026-06-25")
  const [checkOut, setCheckOut] = React.useState("2026-06-27")
  const [guests, setGuests] = React.useState("2-1")
  const [roomId, setRoomId] = React.useState(hotel.rooms[0]?.id ?? "")

  const room = hotel.rooms.find((r) => r.id === roomId) ?? hotel.rooms[0]
  const roomItems = hotel.rooms.map((r) => ({ value: r.id, label: r.name }))

  const nights = React.useMemo(() => {
    const diff =
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000
    return Number.isFinite(diff) && diff > 0 ? Math.round(diff) : 1
  }, [checkIn, checkOut])

  const subtotal = room.pricePerNight * nights
  const taxes = Math.round(subtotal * TAX_RATE)
  const total = subtotal + taxes
  const nightLabel = nights === 1 ? "night" : "nights"

  return (
    <Card id="reserve" className="scroll-mt-24 lg:sticky lg:top-24">
      <CardContent className="space-y-4">
        {/* Price header */}
        <div className="flex items-end justify-between gap-2">
          <div>
            {hotel.originalPrice ? (
              <span className="text-muted-foreground mr-1 text-sm line-through">
                {formatCurrency(hotel.originalPrice)}
              </span>
            ) : null}
            <span className="font-heading text-2xl font-semibold">
              {formatCurrency(room.pricePerNight)}
            </span>
            <span className="text-muted-foreground text-sm"> / night</span>
          </div>
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="size-3" />
            Best Price
          </Badge>
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
                onChange={(e) => setCheckOut(e.target.value)}
                className="h-9 pl-8"
              />
            </div>
          </div>
        </div>

        {/* Guests */}
        <div className="space-y-1.5">
          <Label>Guests &amp; Rooms</Label>
          <Select
            items={guestOptions}
            value={guests}
            onValueChange={(v) => setGuests(v as string)}
          >
            <SelectTrigger className="h-9 w-full">
              <Users className="text-muted-foreground size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {guestOptions.map((o) => (
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
            onValueChange={(v) => setRoomId(v as string)}
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

        {/* Price breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {formatCurrency(room.pricePerNight)} × {nights} {nightLabel}
            </span>
            <span className="font-medium">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Taxes &amp; fees</span>
            <span className="font-medium">{formatCurrency(taxes)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-base">
            <span className="font-heading font-semibold">Total</span>
            <span className="font-heading font-semibold">
              {formatCurrency(total)}
            </span>
          </div>
        </div>

        {/* CTA — proceed to the multi-step checkout flow */}
        <Button
          className="w-full"
          size="lg"
          onClick={() => {
            const params = new URLSearchParams({
              hotel: hotel.id,
              room: room.id,
              checkin: checkIn,
              checkout: checkOut,
              guests,
            })
            router.push(`/checkout?${params.toString()}`)
          }}
        >
          Continue to Checkout
        </Button>

        <div className="text-muted-foreground flex items-start gap-2 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            <span className="text-foreground font-medium">Free Cancellation</span>
            <span className="block text-xs">Up to 24 hours before check-in</span>
          </span>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => toast("Opening WhatsApp to reserve…")}
        >
          <MessageCircle className="size-4" />
          Reserve on WhatsApp
        </Button>
      </CardContent>
    </Card>
  )
}
