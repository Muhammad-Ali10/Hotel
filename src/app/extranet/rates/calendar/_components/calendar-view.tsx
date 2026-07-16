"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { formatCurrency } from "@/lib/format"
import { datesInRange, guestName, rateForDate, toISODate } from "@/lib/domain"
import { useStore } from "@/store"
import { useActiveHotel, usePartnerReservations } from "@/store/selectors"
import { cn } from "@/lib/utils"
import { PageHeader, SectionCard } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { NotFoundCard } from "@/components/shared/not-found-card"

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function monthCells(year: number, monthIndex: number) {
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) =>
      toISODate(new Date(year, monthIndex, i + 1))
    ),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

/**
 * The rate and availability calendar. A rate set on a date prices that night on
 * the public listing and at checkout; closing a date blocks it in the guest's
 * date picker. Editing a day used to fire a toast against a hardcoded $189.
 */
export function CalendarView() {
  const hotel = useActiveHotel()
  const reservations = usePartnerReservations()
  const setRateOverride = useStore((s) => s.setRateOverride)
  const setDatesClosed = useStore((s) => s.setDatesClosed)

  const [monthOffset, setMonthOffset] = React.useState(0)
  const [editDate, setEditDate] = React.useState<string | null>(null)

  const base = new Date()
  const view = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1)
  const label = view.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const cells = monthCells(view.getFullYear(), view.getMonth())

  // Which nights each reservation occupies, so the grid shows real occupancy.
  const bookedNights = React.useMemo(() => {
    const map = new Map<string, typeof reservations>()
    for (const r of reservations) {
      for (const iso of datesInRange(r.checkIn, r.checkOut)) {
        const list = map.get(iso)
        if (list) list.push(r)
        else map.set(iso, [r])
      }
    }
    return map
  }, [reservations])

  if (!hotel) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its calendar."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const baseRoom = hotel.rooms.reduce((a, b) => (a.pricePerNight <= b.pricePerNight ? a : b))
  const arrivals = reservations
    .filter((r) => r.checkIn.startsWith(toISODate(view).slice(0, 7)))
    .slice(0, 6)

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" subtitle={`${hotel.name} · ${label}`}>
        <Button variant="outline" size="sm" render={<Link href="/extranet/rates" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMonthOffset((m) => m - 1)}>
          <ChevronLeft className="size-4" />
          Prev
        </Button>
        <Button variant="outline" size="sm" onClick={() => setMonthOffset((m) => m + 1)}>
          Next
          <ChevronRight className="size-4" />
        </Button>
      </PageHeader>

      <p className="text-muted-foreground text-sm">
        Rates and closures here drive the public date picker and the price a guest is
        quoted.{" "}
        <Link
          href={`/hotels/${hotel.id}#reserve`}
          target="_blank"
          className="text-foreground inline-flex items-center gap-1 hover:underline"
        >
          Preview <ExternalLink className="size-3" />
        </Link>
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="p-4">
          <div className="grid grid-cols-7 gap-1">
            {weekdays.map((d) => (
              <div
                key={d}
                className="text-muted-foreground pb-2 text-center text-xs font-medium"
              >
                {d}
              </div>
            ))}
            {cells.map((iso, i) => {
              if (!iso) return <div key={`empty-${i}`} />
              const day = Number(iso.slice(-2))
              const closed = hotel.availability.closedDates.includes(iso)
              const booked = bookedNights.get(iso) ?? []
              const rate = rateForDate(hotel, baseRoom, iso)
              const overridden = hotel.availability.rateOverrides[iso] !== undefined

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setEditDate(iso)}
                  className={cn(
                    "hover:border-primary flex min-h-20 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors",
                    closed && "bg-destructive/5 border-destructive/30"
                  )}
                >
                  <span className="text-xs font-medium">{day}</span>
                  <span
                    className={cn(
                      "text-xs",
                      overridden ? "text-primary font-semibold" : "text-muted-foreground"
                    )}
                  >
                    {formatCurrency(rate)}
                  </span>
                  {closed ? (
                    <span className="text-destructive text-[10px] font-medium">Closed</span>
                  ) : booked.length > 0 ? (
                    <span className="bg-primary/10 text-primary rounded px-1 text-[10px] font-medium">
                      {booked.length} booked
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </Card>

        <div className="space-y-6">
          <SectionCard title="This month">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Base rate</span>
                <span className="font-medium">{formatCurrency(baseRoom.pricePerNight)}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Custom rates</span>
                <span className="font-medium">
                  {Object.keys(hotel.availability.rateOverrides).length}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Closed dates</span>
                <span className="font-medium">{hotel.availability.closedDates.length}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Minimum stay</span>
                <span className="font-medium">{hotel.availability.minStay} nights</span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard title="Arrivals">
            <ul className="space-y-3">
              {arrivals.map((b) => (
                <li key={b.id}>
                  <p className="text-sm font-medium">{guestName(b)}</p>
                  <p className="text-muted-foreground text-xs">
                    {b.roomName} · {b.checkIn}
                  </p>
                </li>
              ))}
              {arrivals.length === 0 ? (
                <li className="text-muted-foreground text-sm">No arrivals this month.</li>
              ) : null}
            </ul>
          </SectionCard>
        </div>
      </div>

      {editDate ? (
        <EditDayDialog
          hotelId={hotel.id}
          date={editDate}
          rate={hotel.availability.rateOverrides[editDate] ?? baseRoom.pricePerNight}
          isOverride={hotel.availability.rateOverrides[editDate] !== undefined}
          closed={hotel.availability.closedDates.includes(editDate)}
          booked={(bookedNights.get(editDate) ?? []).length}
          onClose={() => setEditDate(null)}
          onSetRate={(value) => setRateOverride(hotel.id, editDate, value)}
          onSetClosed={(closed) => setDatesClosed(hotel.id, [editDate], closed)}
        />
      ) : null}
    </div>
  )
}

function EditDayDialog({
  date,
  rate,
  isOverride,
  closed,
  booked,
  onClose,
  onSetRate,
  onSetClosed,
}: {
  hotelId: string
  date: string
  rate: number
  isOverride: boolean
  closed: boolean
  booked: number
  onClose: () => void
  onSetRate: (value: number | null) => void
  onSetClosed: (closed: boolean) => void
}) {
  const [value, setValue] = React.useState(String(rate))

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{date}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {booked > 0 ? (
            <Badge variant="outline">
              {booked} {booked === 1 ? "reservation" : "reservations"} on this night
            </Badge>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="calendar-rate">Rate / night (USD)</Label>
            <Input
              id="calendar-rate"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {isOverride
                ? "This night has a custom rate. Other room types scale from it."
                : "Currently using the base rate."}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Closed for arrival</p>
              <p className="text-muted-foreground text-xs">
                Guests can&apos;t book a stay covering this night.
              </p>
            </div>
            <Switch
              checked={closed}
              onCheckedChange={(v) => {
                onSetClosed(v === true)
                toast.success(v ? `${date} closed.` : `${date} reopened.`)
              }}
              aria-label="Closed for arrival"
            />
          </div>
        </div>

        <DialogFooter>
          {isOverride ? (
            <Button
              variant="outline"
              onClick={() => {
                onSetRate(null)
                toast.success(`${date} reset to the base rate.`)
                onClose()
              }}
            >
              Reset to base
            </Button>
          ) : (
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
          )}
          <Button
            onClick={() => {
              const next = Number(value)
              if (!next) {
                toast.error("Enter a rate above zero.")
                return
              }
              onSetRate(next)
              toast.success(`${date} priced at ${formatCurrency(next)} — live on your listing.`)
              onClose()
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
