"use client"

import * as React from "react"
import Link from "next/link"
import { Building2, ChevronLeft } from "lucide-react"

import { availabilityDays, roomLegend } from "@/data/extranet"
import { cn } from "@/lib/utils"
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

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

// Local mock — no per-property / per-room data file exists yet.
const properties = [
  "Grand Horizon",
  "Azure Bay Resort",
  "Alpine Retreat",
  "Metropolitan Grand",
]
const rooms = ["All rooms", ...roomLegend.map((r) => r.room)]

function clamp(n: number) {
  return Math.max(0, Math.min(100, n))
}

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

export function AvailabilityPlanner() {
  const [property, setProperty] = React.useState(properties[0])
  const [room, setRoom] = React.useState(rooms[0])
  const [view, setView] = React.useState<"calendar" | "list">("calendar")

  const propIndex = properties.indexOf(property)
  const roomIndex = rooms.indexOf(room)

  // Derive a deterministic per-property / per-room variation so switching a
  // filter visibly changes the numbers (mock, no backend).
  const days = React.useMemo(
    () =>
      availabilityDays.map((d, i) => {
        const propMod = propIndex * -5
        const roomMod = roomIndex === 0 ? 0 : (((roomIndex + i) % 5) - 2) * 6
        return { ...d, availability: clamp(d.availability + propMod + roomMod) }
      }),
    [propIndex, roomIndex]
  )

  const firstDay = new Date(days[0].date + "T00:00:00").getDay()
  const lead = Array(firstDay).fill(null)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Availability Planner"
        subtitle="Visual overview of room availability across the next 30 days"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/rates" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={property} onValueChange={(v) => setProperty(String(v))}>
          <SelectTrigger size="sm" className="w-[190px]">
            <Building2 className="size-4 opacity-60" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={room} onValueChange={(v) => setRoom(String(v))}>
          <SelectTrigger size="sm" className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rooms.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
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
              {property} — Next 30 Days
              {room !== "All rooms" ? ` · ${room}` : ""}
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
                    bin(d.availability)
                  )}
                >
                  <p className="text-[11px] opacity-70">{d.label}</p>
                  <p className="text-sm font-semibold">{d.availability}%</p>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y">
              {days.map((d) => (
                <li
                  key={d.date}
                  className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0"
                >
                  <span className="w-16 text-sm font-medium">{d.label}</span>
                  <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                    <div
                      className="bg-foreground/70 h-full rounded-full"
                      style={{ width: `${d.availability}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-12 text-right text-sm font-medium">
                    {d.availability}%
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
