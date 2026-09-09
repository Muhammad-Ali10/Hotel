"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { addDays, toISODate } from "@/lib/domain"
import { useCalendar } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
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
 * How much is left to sell, for the next 30 nights.
 *
 * The numbers come from the inventory ledger — the same rows the booking
 * transaction locks — rather than from counting reservations in the browser.
 * That matters more than it sounds: the two disagree the moment a booking is
 * held and not yet paid, cancelled, or moved between rooms, and it is the
 * ledger the database will actually enforce.
 *
 * `sellableUnits`, not the room's unit count, is the denominator. A room can
 * have eight units and six sellable on a night when two are out of service,
 * and "75% free" measured against the eight would be a number nobody can sell.
 */
export function AvailabilityPlanner() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const [roomId, setRoomId] = React.useState("all")
  const [view, setView] = React.useState<"calendar" | "list">("calendar")

  const today = toISODate(new Date())
  const calendar = useCalendar(active?.id ?? "", {
    from: today,
    to: addDays(today, DAYS_AHEAD - 1),
  })

  const rooms = React.useMemo(() => calendar.data?.rooms ?? [], [calendar.data])

  const days = React.useMemo(() => {
    const scope =
      roomId === "all" ? rooms : rooms.filter((r) => r.id === roomId)

    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const date = addDays(today, i)

      let sellable = 0
      let booked = 0
      let openRooms = 0

      for (const room of scope) {
        const stock = room.stock.find((s) => s.date === date)
        if (!stock) continue
        // A closed room sells nothing that night, whatever its stock says.
        if (stock.isClosed) continue
        openRooms += 1
        sellable += stock.sellableUnits
        booked += stock.bookedUnits
      }

      const closed = scope.length > 0 && openRooms === 0
      const availability =
        sellable === 0 ? 0 : Math.round(((sellable - booked) / sellable) * 100)

      return {
        date,
        label: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        availability,
        closed,
        free: Math.max(sellable - booked, 0),
        sellable,
      }
    })
  }, [rooms, roomId, today])

  if (loadingProperties || calendar.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="bg-muted h-10 w-72 animate-pulse rounded-lg" />
        <div className="bg-muted h-96 animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to plan its availability."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  if (calendar.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {calendar.error.message}
      </div>
    )
  }

  const roomItems = [
    { value: "all", label: "All rooms" },
    ...rooms.map((r) => ({ value: r.id, label: r.name })),
  ]

  const firstDay = new Date(days[0]!.date + "T00:00:00").getDay()
  const lead = Array(firstDay).fill(null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability Planner"
        subtitle="What is left to sell across the next 30 nights"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/rates" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={roomItems}
          value={roomId}
          onValueChange={(v) => setRoomId(String(v))}
        >
          <SelectTrigger size="sm" className="w-[220px]">
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
              {active.name} — Next 30 Nights
              {roomId !== "all"
                ? ` · ${rooms.find((r) => r.id === roomId)?.name ?? ""}`
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

          {rooms.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              This property has no rooms yet, so there is nothing to sell.
            </p>
          ) : view === "calendar" ? (
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
                  title={
                    d.closed
                      ? "Every room closed"
                      : `${d.free} of ${d.sellable} units free`
                  }
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
                  <span className="text-muted-foreground w-32 text-right text-sm">
                    {d.closed ? "Closed" : `${d.free} of ${d.sellable} free`}
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
