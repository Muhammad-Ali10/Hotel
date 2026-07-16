"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { addDays, datesInRange, toISODate } from "@/lib/domain"
import { usePartnerHotels, usePartnerReservations } from "@/store/selectors"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NotFoundCard } from "@/components/shared/not-found-card"

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAYS_AHEAD = 30

function bin(a: number) {
  if (a >= 75) return "bg-muted"
  if (a >= 50) return "bg-foreground/10"
  if (a >= 25) return "bg-foreground/20"
  return "bg-foreground/35"
}

const legend = [
  { label: "75%+", cls: "bg-muted" },
  { label: "50–74%", cls: "bg-foreground/10" },
  { label: "25–49%", cls: "bg-foreground/20" },
  { label: "<25%", cls: "bg-foreground/35" },
]

/**
 * Availability across the next 30 days, counted from real reservations and the
 * property's closed dates. The planner used to filter by properties that were
 * not in the portfolio ("Azure Bay Resort", "Alpine Retreat") over invented
 * percentages.
 */
export function AvailabilityPlanner() {
  const hotels = usePartnerHotels()
  const reservations = usePartnerReservations()

  const [hotelId, setHotelId] = React.useState("")
  const [roomId, setRoomId] = React.useState("all")
  const [view, setView] = React.useState<"calendar" | "list">("calendar")

  const hotel = hotels.find((h) => h.id === hotelId) ?? hotels[0]

  const days = React.useMemo(() => {
    if (!hotel) return []
    const today = toISODate(new Date())
    const rooms = roomId === "all" ? hotel.rooms : hotel.rooms.filter((r) => r.id === roomId)
    const capacity = rooms.reduce((sum, r) => sum + r.units, 0)

    const relevant = reservations.filter(
      (r) => r.hotelId === hotel.id && (roomId === "all" || r.roomId === roomId)
    )

    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const date = addDays(today, i)
      const closed = hotel.availability.closedDates.includes(date)
      const occupied = relevant.filter((r) =>
        datesInRange(r.checkIn, r.checkOut).includes(date)
      ).length
      const availability = closed
        ? 0
        : Math.round(((capacity - occupied) / Math.max(capacity, 1)) * 100)
      return {
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        availability,
        closed,
      }
    })
  }, [hotel, roomId, reservations])

  if (!hotel || days.length === 0) {
    return (
      <NotFoundCard
        title="No properties"
        description="Your portfolio has no properties to plan."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const hotelItems = hotels.map((h) => ({ value: h.id, label: h.name }))
  const roomItems = [
    { value: "all", label: "All rooms" },
    ...hotel.rooms.map((r) => ({ value: r.id, label: r.name })),
  ]

  const firstDay = new Date(days[0].date + "T00:00:00").getDay()
  const lead = Array(firstDay).fill(null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability Planner"
        subtitle="Room availability across the next 30 days, from live reservations"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/rates" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={hotelItems}
          value={hotel.id}
          onValueChange={(v) => {
            setHotelId(String(v))
            setRoomId("all")
          }}
        >
          <SelectTrigger size="sm" className="w-[210px]">
            <Building2 className="size-4 opacity-60" />
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

        <Select items={roomItems} value={roomId} onValueChange={(v) => setRoomId(String(v))}>
          <SelectTrigger size="sm" className="w-[200px]">
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

        <div className="ml-auto flex gap-1">
          <Button
            size="sm"
            variant={view === "calendar" ? "default" : "outline"}
            onClick={() => setView("calendar")}
          >
            Calendar
          </Button>
          <Button
            size="sm"
            variant={view === "list" ? "default" : "outline"}
            onClick={() => setView("list")}
          >
            List
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-sm font-semibold">
              {hotel.name} — Next 30 Days
              {roomId !== "all"
                ? ` · ${hotel.rooms.find((r) => r.id === roomId)?.name}`
                : ""}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              {legend.map((l) => (
                <span
                  key={l.label}
                  className="text-muted-foreground flex items-center gap-1.5 text-xs"
                >
                  <span className={cn("size-3 rounded-sm", l.cls)} />
                  {l.label}
                </span>
              ))}
            </div>
          </div>

          {view === "calendar" ? (
            <div className="grid grid-cols-7 gap-2">
              {weekdays.map((d) => (
                <div
                  key={d}
                  className="text-muted-foreground text-center text-xs font-medium uppercase"
                >
                  {d}
                </div>
              ))}
              {lead.map((_, i) => (
                <div key={`lead-${i}`} />
              ))}
              {days.map((d) => (
                <div
                  key={d.date}
                  className={cn(
                    "rounded-lg border p-2 text-center",
                    d.closed ? "border-destructive/30 bg-destructive/5" : bin(d.availability)
                  )}
                >
                  <p className="text-[11px] opacity-70">{d.label}</p>
                  <p className="text-sm font-semibold">
                    {d.closed ? "Closed" : `${d.availability}%`}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {days.map((d) => (
                <li key={d.date} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-16 text-sm font-medium">{d.label}</span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-foreground/70 h-full rounded-full"
                      style={{ width: `${d.availability}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-20 text-right text-sm">
                    {d.closed ? "Closed" : `${d.availability}% free`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
