"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import type { CalendarNight, CalendarRoom } from "@/lib/api/endpoints"
import { formatCurrency } from "@/lib/format"
import { toISODate } from "@/lib/domain"
import {
  useCalendar,
  usePartnerBookings,
  useSetClosed,
  useSetRates,
} from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
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
 * The rate and availability calendar.
 *
 * What this screen shows is now the same ledger the booking transaction locks,
 * and what it writes is what the quote engine reads. The old version could not
 * have been: it modelled the calendar as ONE price per date for the whole
 * hotel, and one closed/open flag for the whole hotel.
 *
 * Neither is how any of this works:
 *
 *   - **a price belongs to a rate plan**, not a property (rule #27). The same
 *     room sells flexible and non-refundable at different nightly rates, and
 *     one number for the hotel cannot express that.
 *   - **a closure belongs to a room.** Closing the double for a refit does not
 *     close the suite.
 *
 * So the screen asks which room and which plan first, and every cell is that
 * plan on that night. Changing the pair changes what is being edited, which is
 * a truth the old screen hid rather than a step it saved.
 */
export function CalendarView() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const [monthOffset, setMonthOffset] = React.useState(0)
  const [editDate, setEditDate] = React.useState<string | null>(null)
  const [choice, setChoice] = React.useState<{ roomId: string; planId: string } | null>(null)

  const base = new Date()
  const view = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1)
  const label = view.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  const cells = monthCells(view.getFullYear(), view.getMonth())

  // The whole month, in one request — `to` is inclusive.
  const from = toISODate(new Date(view.getFullYear(), view.getMonth(), 1))
  const to = toISODate(new Date(view.getFullYear(), view.getMonth() + 1, 0))

  const calendar = useCalendar(active?.id ?? "", { from, to })
  const bookings = usePartnerBookings()
  const setRates = useSetRates(active?.id ?? "")
  const setClosed = useSetClosed(active?.id ?? "")

  const rooms = React.useMemo(() => calendar.data?.rooms ?? [], [calendar.data])

  /*
   * The selection, resolved rather than stored.
   *
   * `choice` holds only what the partner picked. Everything else reads through
   * to the response — so paging to a month where the chosen plan has no rows
   * falls back rather than rendering a blank grid, and no effect has to keep
   * the two in step.
   */
  const selected = React.useMemo(() => {
    if (rooms.length === 0) return null

    const room =
      rooms.find((r) => r.id === choice?.roomId) ??
      rooms.find((r) => r.ratePlans.some((p) => p.status === "active")) ??
      rooms[0]!

    const plans = room.ratePlans.filter((p) => p.status === "active")
    const plan = plans.find((p) => p.id === choice?.planId) ?? plans[0] ?? room.ratePlans[0]

    return plan ? { room, plan } : null
  }, [rooms, choice])

  const nights = React.useMemo(() => {
    const map = new Map<string, CalendarNight>()
    for (const n of selected?.plan.nights ?? []) map.set(n.date, n)
    return map
  }, [selected])

  const stock = React.useMemo(() => {
    const map = new Map<string, CalendarRoom["stock"][number]>()
    for (const s of selected?.room.stock ?? []) map.set(s.date, s)
    return map
  }, [selected])

  if (loadingProperties || calendar.isPending) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]" aria-busy="true">
        <div className="bg-muted h-[28rem] animate-pulse rounded-xl" />
        <div className="bg-muted h-64 animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to manage its calendar."
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

  if (!selected) {
    return (
      <NotFoundCard
        title="Nothing to price yet"
        description="This property needs a room with a rate plan before a calendar means anything."
        href="/extranet/property/room-types"
        cta="Room types"
      />
    )
  }

  const month = from.slice(0, 7)
  const arrivals = (bookings.data ?? [])
    .filter(
      (b) =>
        b.propertyId === active.id &&
        b.checkIn.startsWith(month) &&
        b.status !== "cancelled"
    )
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .slice(0, 6)

  const overrides = (selected.plan.nights ?? []).filter((n) => n.isOverridden).length
  const closedDays = (selected.room.stock ?? []).filter((s) => s.isClosed).length

  return (
    <div className="space-y-6">
      <PageHeader title="Calendar" subtitle={`${active.name} · ${label}`}>
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

      {/*
       * What is being edited, said out loud.
       *
       * A grid of prices with no room and no plan named above it is the exact
       * ambiguity that let the old screen pretend a hotel has one rate.
       */}
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="cal-room" className="text-xs">
            Room
          </Label>
          <select
            id="cal-room"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={selected.room.id}
            onChange={(e) => {
              const room = rooms.find((r) => r.id === e.target.value)
              const plan = room?.ratePlans.find((p) => p.status === "active") ?? room?.ratePlans[0]
              // The plan has to move with the room — a plan belongs to one.
              setChoice({ roomId: e.target.value, planId: plan?.id ?? "" })
            }}
          >
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cal-plan" className="text-xs">
            Rate plan
          </Label>
          <select
            id="cal-plan"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={selected.plan.id}
            onChange={(e) => setChoice({ roomId: selected.room.id, planId: e.target.value })}
          >
            {selected.room.ratePlans
              .filter((p) => p.status === "active")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>

        <p className="text-muted-foreground flex-1 text-sm">
          Rates and closures here drive the public date picker and the price a guest
          is quoted.{" "}
          <Link
            href={`/hotels/${active.slug}#reserve`}
            target="_blank"
            className="text-foreground inline-flex items-center gap-1 hover:underline"
          >
            Preview <ExternalLink className="size-3" />
          </Link>
        </p>
      </Card>

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
              const night = nights.get(iso)
              const stockRow = stock.get(iso)
              const closed = stockRow?.isClosed ?? false
              const booked = stockRow?.bookedUnits ?? 0

              return (
                <button
                  key={iso}
                  type="button"
                  disabled={!night}
                  onClick={() => setEditDate(iso)}
                  className={cn(
                    "hover:border-primary flex min-h-20 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors",
                    closed && "bg-destructive/5 border-destructive/30",
                    !night && "opacity-40"
                  )}
                >
                  <span className="text-xs font-medium">{day}</span>
                  <span
                    className={cn(
                      "text-xs",
                      night?.isOverridden
                        ? "text-primary font-semibold"
                        : "text-muted-foreground"
                    )}
                  >
                    {night ? formatCurrency(night.rate) : "—"}
                  </span>
                  {closed ? (
                    <span className="text-destructive text-[10px] font-medium">Closed</span>
                  ) : booked > 0 ? (
                    <span className="bg-primary/10 text-primary rounded px-1 text-[10px] font-medium">
                      {booked}/{selected.room.units} sold
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
                <span className="text-muted-foreground">Plan rate</span>
                <span className="font-medium">
                  {formatCurrency(selected.plan.basePrice)}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Custom rates</span>
                <span className="font-medium">{overrides}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Closed dates</span>
                <span className="font-medium">{closedDays}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-muted-foreground">Units</span>
                <span className="font-medium">{selected.room.units}</span>
              </li>
            </ul>
            <p className="text-muted-foreground pt-2 text-xs">
              Counted for {selected.room.name} · {selected.plan.name}, this month
              only.
            </p>
          </SectionCard>

          <SectionCard title="Arrivals">
            <ul className="space-y-3">
              {arrivals.map((b) => (
                <li key={b.id}>
                  <p className="text-sm font-medium">
                    {b.guest.firstName} {b.guest.lastName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {b.roomName} · {b.checkIn}
                  </p>
                </li>
              ))}
              {bookings.isPending ? (
                <li className="text-muted-foreground text-sm">Loading…</li>
              ) : arrivals.length === 0 ? (
                <li className="text-muted-foreground text-sm">No arrivals this month.</li>
              ) : null}
            </ul>
          </SectionCard>
        </div>
      </div>

      {editDate && nights.get(editDate) ? (
        <EditDayDialog
          key={`${selected.plan.id}:${editDate}`}
          propertyId={active.id}
          roomId={selected.room.id}
          roomName={selected.room.name}
          planId={selected.plan.id}
          planName={selected.plan.name}
          planPrice={selected.plan.basePrice}
          night={nights.get(editDate)!}
          stock={stock.get(editDate) ?? null}
          busy={setRates.isPending || setClosed.isPending}
          onSetRate={(cents) =>
            setRates.mutate(
              {
                ratePlanId: selected.plan.id,
                from: editDate,
                to: editDate,
                rate: cents,
              },
              {
                onSuccess: () =>
                  toast.success(
                    cents === null
                      ? `${editDate} back to the plan rate.`
                      : `${editDate} priced at ${formatCurrency(cents)}.`
                  ),
                onError: (e) => toast.error(e.message),
              }
            )
          }
          onSetClosed={(isClosed) =>
            setClosed.mutate(
              {
                propertyId: active.id,
                roomIds: [selected.room.id],
                from: editDate,
                to: editDate,
                isClosed,
              },
              {
                onSuccess: () =>
                  toast.success(
                    isClosed
                      ? `${selected.room.name} closed on ${editDate}.`
                      : `${selected.room.name} reopened on ${editDate}.`
                  ),
                onError: (e) => toast.error(e.message),
              }
            )
          }
          onClose={() => setEditDate(null)}
        />
      ) : null}
    </div>
  )
}

function EditDayDialog({
  roomName,
  planName,
  planPrice,
  night,
  stock,
  busy,
  onClose,
  onSetRate,
  onSetClosed,
}: {
  propertyId: string
  roomId: string
  roomName: string
  planId: string
  planName: string
  planPrice: number
  night: CalendarNight
  stock: { bookedUnits: number; sellableUnits: number; isClosed: boolean } | null
  busy: boolean
  onClose: () => void
  onSetRate: (cents: number | null) => void
  onSetClosed: (isClosed: boolean) => void
}) {
  const [value, setValue] = React.useState(String(night.rate / 100))

  const booked = stock?.bookedUnits ?? 0
  const closed = stock?.isClosed ?? false

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{night.date}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            {roomName} · {planName}
          </p>

          {booked > 0 ? (
            <Badge variant="outline">
              {booked} {booked === 1 ? "unit" : "units"} sold on this night
            </Badge>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="calendar-rate">Rate / night (USD)</Label>
            <Input
              id="calendar-rate"
              type="number"
              min={0}
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              {night.isOverridden
                ? `This night has its own rate. The plan's is ${formatCurrency(planPrice)}.`
                : "Currently the plan rate."}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Closed</p>
              <p className="text-muted-foreground text-xs">
                {/*
                 * Closing a SOLD night does not un-sell it.
                 *
                 * The nights already booked stay booked — this stops new ones,
                 * which is worth saying rather than letting a partner discover
                 * it from a guest who still turns up.
                 */}
                {booked > 0
                  ? "Stops new bookings. The nights already sold still stand."
                  : `Guests can't book ${roomName} for this night.`}
              </p>
            </div>
            <Switch
              checked={closed}
              disabled={busy}
              onCheckedChange={(v) => onSetClosed(v === true)}
              aria-label="Closed"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {night.isOverridden ? (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                // `null` clears it, which is not the same as writing the plan's
                // number: tomorrow's change to the plan should reach this night.
                onSetRate(null)
                onClose()
              }}
            >
              Use plan rate
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              disabled={busy}
              onClick={() => {
                const dollars = Number(value)
                if (!Number.isFinite(dollars) || dollars < 0) {
                  toast.error("Enter a rate of zero or more.")
                  return
                }
                onSetRate(Math.round(dollars * 100))
                onClose()
              }}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
