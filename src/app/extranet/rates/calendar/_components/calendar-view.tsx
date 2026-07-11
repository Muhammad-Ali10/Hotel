"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { toast } from "sonner"

import {
  calendarBookings,
  calendarStats,
  roomLegend,
  upcomingArrivals,
} from "@/data/extranet"
import { PageHeader, SectionCard } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// The mock bookings belong to the base month (June 2026).
const BASE_YEAR = 2026
const BASE_MONTH = 5 // June (0-based)

function visibleMonth(offset: number) {
  const d = new Date(BASE_YEAR, BASE_MONTH + offset, 1)
  return {
    year: d.getFullYear(),
    monthIndex: d.getMonth(),
    label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    monthName: d.toLocaleDateString("en-US", { month: "long" }),
  }
}

function buildCells(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function CalendarView() {
  const [monthOffset, setMonthOffset] = React.useState(0)
  const [editDay, setEditDay] = React.useState<number | null>(null)

  const { year, monthIndex, label, monthName } = visibleMonth(monthOffset)
  const cells = buildCells(year, monthIndex)
  // Bookings in the mock only exist for the base month.
  const showBookings = monthOffset === 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        subtitle={`Visual overview of all bookings · ${label}`}
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/rates" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMonthOffset(0)}
        >
          Today
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous month"
            onClick={() => setMonthOffset((o) => o - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next month"
            onClick={() => setMonthOffset((o) => o + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        {/* Calendar grid */}
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b">
            {weekdays.map((d) => (
              <div
                key={d}
                className="text-muted-foreground p-2 text-center text-xs font-medium uppercase"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              if (!day) {
                return (
                  <div
                    key={i}
                    className="min-h-24 border-r border-b last:border-r-0 [&:nth-child(7n)]:border-r-0"
                  />
                )
              }
              const bookings = showBookings
                ? calendarBookings.filter((b) => b.day === day)
                : []
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setEditDay(day)}
                  aria-label={`Edit rate for ${monthName} ${day}`}
                  className="hover:bg-muted/50 focus-visible:ring-ring min-h-24 cursor-pointer border-r border-b p-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none last:border-r-0 [&:nth-child(7n)]:border-r-0"
                >
                  <span className="text-muted-foreground text-xs font-medium">
                    {day}
                  </span>
                  <div className="mt-1 space-y-1">
                    {bookings.slice(0, 2).map((b) => (
                      <div
                        key={b.id}
                        className="bg-muted truncate rounded px-1 py-0.5 text-[10px] font-medium"
                        title={`${b.guest} · ${b.room}`}
                      >
                        {b.guest}
                      </div>
                    ))}
                    {bookings.length > 2 ? (
                      <div className="text-muted-foreground px-1 text-[10px]">
                        +{bookings.length - 2} more
                      </div>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>
        </Card>

        {/* Right rail */}
        <div className="space-y-6">
          <SectionCard title="Room Type Legend">
            <ul className="space-y-2">
              {roomLegend.map((r) => (
                <li
                  key={r.room}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{r.room}</span>
                  <span className="text-muted-foreground font-medium">
                    {r.count}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
              <div>
                <p className="font-heading text-xl font-semibold">
                  {calendarStats.total}
                </p>
                <p className="text-muted-foreground text-xs">Total Bookings</p>
              </div>
              <div>
                <p className="font-heading text-xl font-semibold">
                  {calendarStats.uniqueGuests}
                </p>
                <p className="text-muted-foreground text-xs">Unique Guests</p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Upcoming Bookings" description="Next 8 arrivals">
            <ul className="divide-y">
              {upcomingArrivals.map((b) => (
                <li key={b.id} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-sm font-medium">{b.guest}</p>
                  <p className="text-muted-foreground text-xs">
                    {b.room} · June {b.day}
                  </p>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>

      <Dialog
        key={editDay ?? "none"}
        open={editDay !== null}
        onOpenChange={(open) => !open && setEditDay(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Edit rate — {monthName} {editDay}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="calendar-rate">Rate / Night (USD)</Label>
            <Input
              id="calendar-rate"
              type="number"
              defaultValue={189}
              placeholder="0.00"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              onClick={() => {
                setEditDay(null)
                toast.success("Rate updated")
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
