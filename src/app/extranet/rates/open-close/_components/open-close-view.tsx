"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { cellPad } from "@/lib/extranet/constants"
import { formatDate } from "@/lib/format"
import { addDays, datesInRange, toISODate } from "@/lib/domain"
import { useStore } from "@/store"
import { useActiveHotel } from "@/store/selectors"
import { PageHeader, SectionCard } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { NotFoundCard } from "@/components/shared/not-found-card"

/**
 * Availability. Closing a date here blocks it in the public date picker and
 * grays the property out in search results for those dates — the buttons used
 * to toast and change nothing.
 */
export function OpenCloseView() {
  const hotel = useActiveHotel()
  const setDatesClosed = useStore((s) => s.setDatesClosed)
  const setMinStay = useStore((s) => s.setMinStay)

  const today = toISODate(new Date())
  const [from, setFrom] = React.useState(today)
  const [to, setTo] = React.useState(addDays(today, 6))

  if (!hotel) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its availability."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const closed = [...hotel.availability.closedDates].sort()
  const upcoming = closed.filter((d) => d >= today)

  function applyRange(shouldClose: boolean) {
    const dates = datesInRange(from, addDays(to, 1))
    if (dates.length === 0) {
      toast.error("Pick a valid date range.")
      return
    }
    setDatesClosed(hotel!.id, dates, shouldClose)
    toast.success(
      `${dates.length} ${dates.length === 1 ? "date" : "dates"} ${
        shouldClose ? "closed" : "opened"
      } — the public date picker updates immediately.`
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Open / Close Dates"
        subtitle={`Availability for ${hotel.name}`}
      >
        <Button
          variant="outline"
          size="sm"
          render={
            <Link href={`/hotels/${hotel.id}#reserve`} target="_blank">
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
        description="Closed dates cannot be booked by guests."
      >
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
          <Button size="sm" variant="outline" onClick={() => applyRange(false)}>
            Open range
          </Button>
          <Button size="sm" variant="destructive" onClick={() => applyRange(true)}>
            Close range
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Minimum stay"
        description="Guests cannot book a stay shorter than this."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="min-stay">Nights</Label>
            <Input
              id="min-stay"
              type="number"
              min={1}
              defaultValue={hotel.availability.minStay}
              className="h-9 w-28"
              onBlur={(e) => {
                const next = Number(e.target.value)
                if (!next || next === hotel.availability.minStay) return
                setMinStay(hotel.id, next)
                toast.success(`Minimum stay set to ${next} nights.`)
              }}
            />
          </div>
          <p className="text-muted-foreground pb-2 text-sm">
            Currently {hotel.availability.minStay}{" "}
            {hotel.availability.minStay === 1 ? "night" : "nights"}.
          </p>
        </div>
      </SectionCard>

      <div className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Closed dates ({upcoming.length} upcoming)
        </h2>
        <Card className="py-0">
          <div className="overflow-x-auto">
            <Table className={cellPad}>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcoming.map((d) => (
                  <TableRow key={d}>
                    <TableCell className="font-medium">{formatDate(d)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-destructive border-destructive/30">
                        Closed
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setDatesClosed(hotel.id, [d], false)
                          toast.success(`${formatDate(d)} reopened.`)
                        }}
                      >
                        Reopen
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {upcoming.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground py-8 text-center">
                      Every upcoming date is open for booking.
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
