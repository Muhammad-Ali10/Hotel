"use client"

import * as React from "react"
import { CalendarDays, MessageCircle, Phone, ShieldCheck, Users } from "lucide-react"
import { toast } from "sonner"

import type { Room } from "@/types"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
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

export function BookingWidget({
  hotelName,
  pricePerNight,
}: {
  hotelName: string
  pricePerNight: number
}) {
  const [guests, setGuests] = React.useState("2-1")

  return (
    <Card className="lg:sticky lg:top-24">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold">Book Your Stay</h2>
          <Badge variant="secondary" className="gap-1">
            <ShieldCheck className="size-3" />
            BEST PRICE GUARANTEE
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="check-in">Check in</Label>
            <div className="relative">
              <CalendarDays className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input id="check-in" type="date" defaultValue="2026-06-25" className="h-9 pl-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="check-out">Check out</Label>
            <div className="relative">
              <CalendarDays className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input id="check-out" type="date" defaultValue="2026-06-27" className="h-9 pl-8" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Guests &amp; Rooms</Label>
          <Select value={guests} onValueChange={(v) => setGuests(v as string)}>
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

        <Button
          className="w-full"
          size="lg"
          onClick={() => toast.success("Checking availability for your dates…")}
        >
          Check Availability
        </Button>

        <div className="text-muted-foreground flex items-start gap-2 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            <span className="text-foreground font-medium">Free Cancellation</span>
            <span className="block text-xs">Up to 24 hours before check-in</span>
          </span>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Price per night</span>
            <span className="font-heading font-semibold">
              {formatCurrency(pricePerNight)}
            </span>
          </div>
          <div className="text-muted-foreground flex items-center justify-between text-sm">
            <span>Select a room to see total price</span>
            <span className="font-medium">0</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            className={cn("w-full bg-emerald-600 text-white hover:bg-emerald-700")}
            onClick={() => toast("Opening WhatsApp to reserve…")}
          >
            <MessageCircle className="size-4" />
            Reserve on WhatsApp
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => toast(`Calling ${hotelName} reservations…`)}
          >
            <Phone className="size-4" />
            Need help? Call Us
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
