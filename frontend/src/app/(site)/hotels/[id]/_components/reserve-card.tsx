"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { AlertTriangle, CalendarDays, Loader2, ShieldCheck, Users } from "lucide-react"

import type { PropertyDetail } from "@stayora/shared"
import { formatCurrency } from "@/lib/format"
import { addDays, parseISODate, toISODate } from "@/lib/domain"
import { useQuote } from "@/lib/api/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/** Party sizes the chosen room can actually sleep. */
function guestOptions(max: number) {
  return Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1).map((n) => ({
    value: String(n),
    label: `${n} ${n === 1 ? "Guest" : "Guests"}`,
  }))
}

/** ISO-string in, ISO-string out — the rest of the card speaks ISO. */
function DateField({
  label,
  value,
  disabled,
  onSelect,
}: {
  label: string
  value: string
  disabled: (Date | { before: Date })[]
  onSelect: (iso: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selected = parseISODate(value)

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full justify-start gap-2 font-normal"
            >
              <CalendarDays className="text-muted-foreground size-4" />
              {format(selected, "d MMM yyyy")}
            </Button>
          }
        />
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            disabled={disabled}
            onSelect={(date) => {
              if (date) onSelect(toISODate(date))
              setOpen(false)
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

/**
 * The booking box.
 *
 * Every figure here comes from the SERVER (rule #13). It used to price the
 * stay in the browser with `priceBooking()`, which was a second implementation
 * of the thing the API already does — and once the detail page went live it
 * became a wrong one: it read per-night rates from a client-side cache that no
 * longer exists, so every stay came out at the cheapest plan's flat rate, with
 * no promotion ever applied. The guest saw one number here and a different one
 * at checkout.
 *
 * Now the card asks `POST /properties/:slug/quote` and renders the answer. The
 * server is the only thing that knows what a stay costs, which is also why it
 * is the only thing allowed to say.
 */
export function ReserveCard({
  detail,
  selectedRoomId,
  onSelectRoom,
}: {
  detail: PropertyDetail
  selectedRoomId?: string
  onSelectRoom?: (roomId: string) => void
}) {
  const router = useRouter()
  const quote = useQuote(detail.slug)

  const tomorrow = React.useMemo(() => addDays(toISODate(new Date()), 1), [])
  const [checkIn, setCheckIn] = React.useState(tomorrow)
  const [checkOut, setCheckOut] = React.useState(() => addDays(tomorrow, 2))
  const [guests, setGuests] = React.useState("2")
  const [ratePlanId, setRatePlanId] = React.useState<string | undefined>(undefined)

  const today = React.useMemo(() => parseISODate(toISODate(new Date())), [])

  const roomId = selectedRoomId ?? detail.rooms[0]?.id ?? ""
  const room = detail.rooms.find((r) => r.id === roomId) ?? detail.rooms[0]

  /*
   * The rate plan resets with the room.
   *
   * Plans belong to a room, so a plan id carried across a room change points
   * at nothing — and the API would answer 404 for a selection the guest can
   * see on screen. Derived rather than stored in an effect, which this repo
   * forbids and which would flash the wrong price for a frame.
   */
  const plans = room?.ratePlans ?? []
  const plan = plans.find((p) => p.id === ratePlanId) ?? plans.find((p) => p.isDefault) ?? plans[0]

  const partySize = Math.min(Number(guests), room?.maxOccupancy ?? Number(guests))

  /*
   * One quote per settled selection.
   *
   * Debounced, because a guest dragging through a calendar changes the dates
   * several times a second and each change is a signed token the server has to
   * mint. The delay is short enough to feel immediate and long enough that
   * scrubbing a month costs one request, not thirty.
   */
  const requestQuote = quote.mutate
  React.useEffect(() => {
    if (!room || !plan || checkOut <= checkIn) return

    const timer = setTimeout(() => {
      requestQuote({
        roomId: room.id,
        ratePlanId: plan.id,
        checkIn,
        checkOut,
        adults: partySize,
        children: 0,
        addOns: [],
      })
    }, 250)

    return () => clearTimeout(timer)
  }, [requestQuote, room, plan, checkIn, checkOut, partySize])

  const priced = quote.data
  const nights = priced?.pricing.nights ?? 0
  const nightLabel = nights === 1 ? "night" : "nights"

  /*
   * A 409 means the dates are genuinely gone; anything else is the request
   * failing. Telling a guest a room is unavailable because the network blipped
   * sends them to a competitor for no reason.
   */
  const soldOut = quote.error?.statusCode === 409
  const failed = quote.error && !soldOut

  function handleContinue() {
    if (!room || !plan) return
    /*
     * The SELECTION travels, not the price.
     *
     * Checkout takes its own quote. A token minted here would already be
     * ageing while the guest reads the page, and rule #13 gives it a lifetime
     * for a reason — the guest should start paying against a fresh one.
     */
    const params = new URLSearchParams({
      hotel: detail.slug,
      room: room.id,
      plan: plan.id,
      checkin: checkIn,
      checkout: checkOut,
      guests: String(partySize),
    })
    router.push(`/checkout?${params.toString()}`)
  }

  if (!room || !plan) {
    return (
      <Card id="reserve" className="scroll-mt-24 lg:sticky lg:top-24">
        <CardContent>
          <p className="text-muted-foreground text-sm">
            This property has no rooms on sale yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card id="reserve" className="scroll-mt-24 lg:sticky lg:top-24">
      <CardContent className="space-y-4">
        {/* Price header — the server's per-night figure once it answers, and
            the plan's own base price until then, so the box is never blank. */}
        <div className="flex items-end justify-between gap-2">
          <div>
            <span className="font-heading text-2xl font-semibold">
              {formatCurrency(priced?.pricing.ratePerNight ?? plan.basePrice)}
            </span>
            <span className="text-muted-foreground text-sm"> / night</span>
          </div>
          {priced?.promotion ? (
            <Badge className="gap-1">
              Save {formatCurrency(priced.promotion.saving)}
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="size-3" />
              Best Price
            </Badge>
          )}
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <DateField
            label="Check in"
            value={checkIn}
            disabled={[{ before: today }]}
            onSelect={(iso) => {
              setCheckIn(iso)
              if (iso >= checkOut) setCheckOut(addDays(iso, 1))
            }}
          />
          <DateField
            label="Check out"
            value={checkOut}
            disabled={[{ before: parseISODate(addDays(checkIn, 1)) }]}
            onSelect={setCheckOut}
          />
        </div>

        {soldOut ? (
          <p className="text-destructive flex items-start gap-1.5 text-sm">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {quote.error?.message ?? "Not available for these dates."}
          </p>
        ) : failed ? (
          <p className="text-destructive flex items-start gap-1.5 text-sm">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            {quote.error?.message}
          </p>
        ) : null}

        {/* Guests */}
        <div className="space-y-1.5">
          <Label>Guests</Label>
          <Select
            items={guestOptions(room.maxOccupancy)}
            value={String(partySize)}
            onValueChange={(v) => setGuests(v as string)}
          >
            <SelectTrigger className="h-9 w-full">
              <Users className="text-muted-foreground size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {guestOptions(room.maxOccupancy).map((o) => (
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
            items={detail.rooms.map((r) => ({ value: r.id, label: r.name }))}
            value={roomId}
            onValueChange={(v) => {
              onSelectRoom?.(v as string)
              // The plans below belong to the old room; let the default win.
              setRatePlanId(undefined)
            }}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {detail.rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/*
          RATE PLAN — new, and the page was wrong without it.

          A room has several plans and they differ in the two things a guest
          actually decides on: what it costs, and whether the card is charged
          today (rule #42). Choosing for them meant a guest could be put on a
          non-refundable prepaid rate they never picked.
        */}
        {plans.length > 1 ? (
          <div className="space-y-1.5">
            <Label>Rate</Label>
            <Select
              items={plans.map((p) => ({ value: p.id, label: p.name }))}
              value={plan.id}
              onValueChange={(v) => setRatePlanId(v as string)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} — {formatCurrency(p.basePrice)}
                    {p.paymentMode === "prepay" ? " · pay now" : " · pay at the property"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <Separator />

        {/* The server's breakdown, and nothing computed here. */}
        {quote.isPending && !priced ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Checking availability…
          </div>
        ) : priced ? (
          <div className="space-y-2 text-sm" aria-busy={quote.isPending}>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {formatCurrency(priced.pricing.ratePerNight)} × {nights} {nightLabel}
              </span>
              <span className="font-medium">{formatCurrency(priced.pricing.roomSubtotal)}</span>
            </div>
            {priced.pricing.discount ? (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span>{priced.pricing.discount.label}</span>
                <span className="font-medium">
                  −{formatCurrency(priced.pricing.discount.amount)}
                </span>
              </div>
            ) : null}
            {priced.pricing.addOnsTotal > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Extras</span>
                <span className="font-medium">{formatCurrency(priced.pricing.addOnsTotal)}</span>
              </div>
            ) : null}
            <Separator />
            <div className="flex items-center justify-between text-base">
              <span className="font-heading font-semibold">Total</span>
              <span className="font-heading font-semibold">
                {formatCurrency(priced.pricing.total)}
              </span>
            </div>
          </div>
        ) : null}

        <Button
          className="w-full"
          size="lg"
          onClick={handleContinue}
          disabled={!priced || soldOut || quote.isPending}
        >
          {soldOut ? "Unavailable for these dates" : "Reserve"}
        </Button>

        <div className="text-muted-foreground flex items-start gap-2 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>
            <span className="text-foreground font-medium">
              {plan.paymentMode === "prepay" ? "Pay now" : "Pay at the property"}
            </span>
            {/* Generated by the API from the policy (rule #1), never stored —
                so what the guest reads and what `refundFor` enforces agree. */}
            <span className="block text-xs">{plan.cancellationText}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
