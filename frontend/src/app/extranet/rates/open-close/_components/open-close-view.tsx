"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { cellPad } from "@/lib/extranet/constants"
import { formatDate } from "@/lib/format"
import { addDays, toISODate } from "@/lib/domain"
import { useCalendar, useSetClosed } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { PageHeader, SectionCard } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NotFoundCard } from "@/components/shared/not-found-card"

/** How far ahead the closed-date list looks. Said out loud on the screen. */
const HORIZON_DAYS = 120

/**
 * Availability — which rooms can be booked on which nights (rule #32).
 *
 * A closure belongs to a ROOM, not to a hotel. Closing the double for a refit
 * does not close the suite, and the old screen could not express the
 * difference: it kept one list of closed dates for the whole property, so a
 * partner taking six rooms out of service had to take all of them.
 *
 * Leaving every room ticked closes the property, which is the renovation case
 * and what the API means by an omitted `roomIds`.
 *
 * **Minimum stay is not here any more.** It was a single number for the hotel,
 * which is not a thing that exists: a minimum stay belongs to a rate plan, and
 * can differ night by night within one. It lives on Restrictions, where it can
 * be said properly, rather than in two places disagreeing.
 */
export function OpenCloseView() {
  const { active, isPending: loadingProperties } = useActiveProperty()

  const today = toISODate(new Date())
  const [from, setFrom] = React.useState(today)
  const [to, setTo] = React.useState(addDays(today, 6))
  const [picked, setPicked] = React.useState<string[] | null>(null)

  const horizon = useCalendar(active?.id ?? "", {
    from: today,
    to: addDays(today, HORIZON_DAYS),
  })
  const setClosed = useSetClosed(active?.id ?? "")

  const rooms = React.useMemo(() => horizon.data?.rooms ?? [], [horizon.data])

  /** Ticked rooms, defaulting to all of them — the renovation case. */
  const selectedIds = React.useMemo(() => {
    if (picked === null) return rooms.map((r) => r.id)
    // A room archived since the tick was made is not a room any more.
    return picked.filter((id) => rooms.some((r) => r.id === id))
  }, [picked, rooms])

  /** Every upcoming night where at least one room is shut, and which. */
  const closures = React.useMemo(() => {
    const byDate = new Map<string, string[]>()
    for (const room of rooms) {
      for (const day of room.stock) {
        if (!day.isClosed || day.date < today) continue
        const list = byDate.get(day.date)
        if (list) list.push(room.name)
        else byDate.set(day.date, [room.name])
      }
    }
    return [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rooms, today])

  if (loadingProperties || horizon.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="bg-muted h-40 animate-pulse rounded-xl" />
        <div className="bg-muted h-64 animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its availability."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  if (horizon.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {horizon.error.message}
      </div>
    )
  }

  const everyRoom = selectedIds.length === rooms.length

  function applyRange(shouldClose: boolean) {
    if (!active) return
    if (to < from) {
      toast.error("The range ends before it starts.")
      return
    }
    if (selectedIds.length === 0) {
      toast.error("Pick at least one room.")
      return
    }

    setClosed.mutate(
      {
        propertyId: active.id,
        // Omitted means "every room", which is what the API already does —
        // sending the full list would say the same thing less clearly.
        ...(everyRoom ? {} : { roomIds: selectedIds }),
        from,
        to,
        isClosed: shouldClose,
      },
      {
        onSuccess: ({ datesAffected: affected }) => {
          toast.success(
            `${affected} ${affected === 1 ? "night" : "nights"} ${
              shouldClose ? "closed" : "opened"
            }`,
            {
              description: everyRoom
                ? "Across every room. The public date picker updates immediately."
                : `Across ${selectedIds.length} of ${rooms.length} rooms.`,
            }
          )
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Open / Close Dates" subtitle={`Availability for ${active.name}`}>
        <Button
          variant="outline"
          size="sm"
          render={
            <Link href={`/hotels/${active.slug}#reserve`} target="_blank">
              <ExternalLink className="size-4" />
              Preview
            </Link>
          }
        />
        <Button variant="outline" size="sm" render={<Link href="/extranet/rates" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <SectionCard
        title="Close or open a date range"
        description="A closed night cannot be booked. Nights already sold are unaffected."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="range-from">From</Label>
              <Input
                id="range-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="range-to">To</Label>
              <Input
                id="range-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={setClosed.isPending}
              onClick={() => applyRange(false)}
            >
              Open range
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={setClosed.isPending}
              onClick={() => applyRange(true)}
            >
              Close range
            </Button>
          </div>

          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Rooms</p>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setPicked(everyRoom ? [] : rooms.map((r) => r.id))}
              >
                {everyRoom ? "Clear all" : "Select all"}
              </Button>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {rooms.map((room) => (
                <label key={room.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selectedIds.includes(room.id)}
                    onCheckedChange={(v) =>
                      setPicked(
                        v === true
                          ? [...selectedIds, room.id]
                          : selectedIds.filter((id) => id !== room.id)
                      )
                    }
                  />
                  {room.name}
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              {everyRoom
                ? "Every room — the whole property is closed for those dates."
                : `${selectedIds.length} of ${rooms.length} rooms. The rest stay bookable.`}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Minimum stay"
        description="Not set here — a minimum stay belongs to a rate plan, and can differ night by night."
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/rates/restrictions">Open Restrictions</Link>}
        />
      </SectionCard>

      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            Closed dates ({closures.length})
          </h2>
          <p className="text-muted-foreground text-sm">
            Next {HORIZON_DAYS} days.
          </p>
        </div>
        <Card className="py-0">
          <div className="overflow-x-auto">
            <Table className={cellPad}>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Rooms closed</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closures.map(([date, names]) => (
                  <TableRow key={date}>
                    <TableCell className="font-medium">{formatDate(date)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="text-destructive border-destructive/30"
                        >
                          {names.length === rooms.length
                            ? "Whole property"
                            : `${names.length} of ${rooms.length}`}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {names.join(", ")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={setClosed.isPending}
                        onClick={() =>
                          setClosed.mutate(
                            {
                              propertyId: active.id,
                              from: date,
                              to: date,
                              isClosed: false,
                            },
                            {
                              onSuccess: () =>
                                toast.success(`${formatDate(date)} reopened`, {
                                  description: "Every room on that night.",
                                }),
                              onError: (e) => toast.error(e.message),
                            }
                          )
                        }
                      >
                        Reopen all
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {closures.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground py-8 text-center">
                      Every night in the next {HORIZON_DAYS} days is open for booking.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
}
