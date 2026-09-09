"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, CalendarDays, MapPin, Users } from "lucide-react"
import { toast } from "sonner"

import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatDate } from "@/lib/format"
import { useBooking, useLiveQuote, useModifyBooking } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StatusBadge } from "@/components/shared/status-badge"
import { NotFoundCard } from "@/components/shared/not-found-card"

/** Party sizes the room can actually sleep — `Room.guests` was display-only. */
function guestOptions(max: number) {
  return Array.from({ length: Math.max(max, 1) }, (_, i) => i + 1).map((n) => ({
    value: String(n),
    label: `${n} ${n === 1 ? "Guest" : "Guests"}`,
  }))
}

export function ModifyBooking({ id }: { id: string }) {
  const router = useRouter()
  const { data, isPending } = useBooking(id)
  const modify = useModifyBooking(id)

  const booking = data?.booking
  const property = data?.property

  /*
   * The draft holds what the guest has CHANGED; everything else reads through
   * to the booking. No effect, so no cascading render when the query settles.
   */
  const [draft, setDraft] = React.useState<{
    checkIn?: string
    checkOut?: string
    guests?: string
    requests?: string
  }>({})

  const checkIn = draft.checkIn ?? booking?.checkIn ?? ""
  const checkOut = draft.checkOut ?? booking?.checkOut ?? ""
  const guests = draft.guests ?? String((booking?.adults ?? 2) + (booking?.children ?? 0))
  const requests = draft.requests ?? booking?.specialRequests ?? ""

  const setCheckIn = (v: string) => setDraft((d) => ({ ...d, checkIn: v }))
  const setCheckOut = (v: string) => setDraft((d) => ({ ...d, checkOut: v }))
  const setGuests = (v: string) => setDraft((d) => ({ ...d, guests: v }))
  const setRequests = (v: string) => setDraft((d) => ({ ...d, requests: v }))

  /*
   * The SERVER prices the change, and signs it.
   *
   * This screen used to run `checkAvailability` and `priceBooking` in the
   * browser against a fixture. Two things were wrong at once: the availability
   * check read inventory the browser does not have, and the price came from a
   * function that never saw the calendar's per-date rates.
   *
   * `modifyBookingId` is what stops the booking blocking itself — the server
   * excludes the nights this reservation already holds, so shifting a stay by
   * one night is not refused by its own room.
   */
  const quote = useLiveQuote(
    data?.property?.slug ?? "",
    booking && data?.property && checkOut > checkIn
      ? {
          roomId: booking.roomId,
          ratePlanId: booking.ratePlanId,
          checkIn,
          checkOut,
          adults: Number(guests),
          children: 0,
          /*
           * The extras the guest already bought, carried across. Dropping them
           * would silently remove breakfast from a stay whose dates moved by a
           * day — and the new total would look like a saving.
           */
          addOns: (data.addOns ?? []).map((a) => ({ valueAddId: a.valueAddId, qty: a.qty })),
          modifyBookingId: booking.id,
        }
      : null
  )

  if (isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading booking">
        <div className="bg-muted h-10 w-64 animate-pulse rounded-lg" />
        <div className="bg-muted h-64 animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!booking || !property) {
    return (
      <NotFoundCard
        title="Booking not found"
        description="We couldn't find a reservation with that reference."
        href="/dashboard/bookings"
        cta="Back to My Bookings"
      />
    )
  }

  if (booking.status === "cancelled") {
    return (
      <NotFoundCard
        title="This booking was cancelled"
        description="Cancelled reservations can no longer be modified."
        href="/dashboard/bookings"
        cta="Back to My Bookings"
      />
    )
  }

  const guestChoices = guestOptions(Math.max(booking.adults + booking.children, 4))
  const newPricing = quote.data?.pricing ?? null
  const quoteError = quote.error
  const validDates = Boolean(newPricing) && !quoteError

  const diff = newPricing ? newPricing.total - booking.total : 0

  const changed =
    checkIn !== booking.checkIn ||
    checkOut !== booking.checkOut ||
    guests !== String(booking.adults + booking.children) ||
    requests.trim() !== (booking.specialRequests ?? "").trim()

  function handleSave() {
    if (!quote.data) {
      toast.error(quoteError?.message ?? "Those dates are not available.")
      return
    }
    if (!changed) {
      toast.info("No changes to save.")
      return
    }
    /*
     * The signed quote, not the numbers.
     *
     * `modifyBookingSchema` takes a `quoteToken` and nothing else — the price
     * the guest was shown is the price the server signed, so a client cannot
     * move a booking onto dates it never priced.
     */
    modify.mutate(quote.data.quoteToken, {
      onSuccess: () => {
        toast.success(`Your booking at ${booking!.propertyName} has been updated.`)
        router.push("/dashboard/bookings")
      },
      onError: (error) => toast.error("We couldn't save that change", {
        description: error.message,
      }),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2"
          render={
            <Link href="/dashboard/bookings">
              <ArrowLeft className="size-4" />
              Back to My Bookings
            </Link>
          }
        />
        <h1 className="font-heading mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Modify Booking
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Update your stay details. Any price difference is shown on the right.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* LEFT — editable details */}
        <div className="space-y-6">
          <Card className="overflow-hidden pt-0">
            <div className="flex flex-col sm:flex-row">
              <div className="relative h-40 w-full shrink-0 overflow-hidden sm:h-auto sm:w-44">
                <Image
                  src={placeholderImage(booking.propertyId, 400, 300)}
                  alt={booking.propertyName}
                  fill
                  sizes="(max-width: 640px) 100vw, 176px"
                  className="object-cover"
                />
              </div>
              <CardContent className="min-w-0 flex-1 py-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-heading text-lg font-semibold">
                      {booking.propertyName}
                    </h2>
                    <p className="text-muted-foreground text-sm">{booking.roomName}</p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                      {booking.ref}
                    </p>
                  </div>
                  <StatusBadge status={booking.status} />
                </div>
                <p className="text-muted-foreground mt-3 flex items-center gap-1 text-sm">
                  <MapPin className="size-3.5" />
                  {booking.city}
                </p>
              </CardContent>
            </div>
          </Card>

          <Card>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="check-in">Check in</Label>
                  <div className="relative">
                    <CalendarDays className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                    <Input
                      id="check-in"
                      type="date"
                      value={checkIn}
                      onChange={(e) => setCheckIn(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="check-out">Check out</Label>
                  <div className="relative">
                    <CalendarDays className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                    <Input
                      id="check-out"
                      type="date"
                      value={checkOut}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
              </div>

              {quoteError ? (
                <p className="text-destructive flex items-center gap-1.5 text-sm">
                  <AlertTriangle className="size-3.5" />
                  {quoteError.message}
                </p>
              ) : null}

              <div className="space-y-1.5">
                <Label>Guests</Label>
                <Select
                  items={guestChoices}
                  value={guests}
                  onValueChange={(v) => setGuests(v as string)}
                >
                  <SelectTrigger className="w-full">
                    <Users className="text-muted-foreground size-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {guestChoices.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="requests">Special requests (optional)</Label>
                <Textarea
                  id="requests"
                  value={requests}
                  onChange={(e) => setRequests(e.target.value)}
                  placeholder="Early check-in, room preference…"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — price change + actions */}
        <div>
          <Card className="lg:sticky lg:top-24">
            <CardContent className="space-y-4">
              <h3 className="font-heading font-semibold">Updated Summary</h3>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">New dates</span>
                  <span className="text-right font-medium">
                    {formatDate(checkIn)} → {formatDate(checkOut)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nights</span>
                  <span className="font-medium">{newPricing?.nights ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Guests</span>
                  <span className="font-medium">{guests}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Original total</span>
                  <span className="font-medium">
                    {formatCurrency(booking.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-base">
                  <span className="font-heading font-semibold">New total</span>
                  <span className="font-heading font-semibold">
                    {newPricing ? formatCurrency(newPricing.total) : "—"}
                  </span>
                </div>
              </div>

              {newPricing ? (
                <div
                  className={
                    diff === 0
                      ? "bg-muted/50 text-muted-foreground rounded-lg border px-3 py-2.5 text-sm"
                      : diff > 0
                        ? "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
                        : "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200"
                  }
                >
                  {diff === 0
                    ? "No price change."
                    : diff > 0
                      ? `Additional payment of ${formatCurrency(diff)} required.`
                      : `You'll be refunded ${formatCurrency(-diff)}.`}
                </div>
              ) : null}

              <Button size="lg" className="w-full" onClick={handleSave} disabled={!validDates || modify.isPending}>
                Save Changes
              </Button>
              <Button
                variant="outline"
                className="w-full"
                render={<Link href="/dashboard/bookings">Discard</Link>}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
