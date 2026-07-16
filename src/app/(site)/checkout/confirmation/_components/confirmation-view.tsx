"use client"

import Link from "next/link"
import Image from "next/image"
import {
  Building2,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  MapPin,
  MessageSquare,
  Phone,
  Users,
} from "lucide-react"

import { formatCurrency, formatDate } from "@/lib/format"
import { formatTime24, guestName } from "@/lib/domain"
import { hotelImage } from "@/lib/images"
import { useBooking, useHotel } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { NotFoundCard } from "@/components/shared/not-found-card"

/**
 * Reads the booking that checkout actually created. The page used to rebuild
 * everything from query parameters and re-derive the total itself, so the
 * figure shown here was a second, independent calculation of what the guest
 * had already approved.
 */
export function ConfirmationView({ reference }: { reference: string }) {
  const booking = useBooking(reference)
  const hotel = useHotel(booking?.hotelId ?? "")

  if (!booking || !hotel) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <NotFoundCard
          title="Booking not found"
          description="We couldn't find a reservation with that reference."
          href="/dashboard/bookings"
          cta="View My Bookings"
        />
      </div>
    )
  }

  const { pricing } = booking
  const nightLabel = pricing.nights === 1 ? "night" : "nights"

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:py-16">
      {/* SUCCESS HEADER */}
      <div className="flex flex-col items-center text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
          <Check className="size-8" />
        </span>
        <h1 className="font-heading mt-5 text-3xl font-semibold tracking-tight">
          Booking Confirmed!
        </h1>
        <p className="text-muted-foreground mt-2 text-pretty">
          Thank you, {guestName(booking)}. Your reservation at{" "}
          <span className="text-foreground font-medium">{booking.hotelName}</span> is confirmed. A
          confirmation email has been sent to {booking.guest.email}.
        </p>
      </div>

      {/* REFERENCE */}
      <div className="bg-muted/50 mt-8 flex items-center justify-between gap-4 rounded-xl border px-5 py-4">
        <div>
          <p className="text-muted-foreground text-xs">Booking reference</p>
          <p className="font-heading text-lg font-semibold tracking-wider">{booking.id}</p>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
          {booking.payment.status === "paid" ? "Paid" : "Pay at property"}
        </span>
      </div>

      {/* DETAILS */}
      <Card className="mt-6">
        <CardContent className="space-y-5">
          <div className="flex gap-3">
            <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-lg">
              <Image
                src={hotelImage(hotel.seed, 160, 160)}
                alt={hotel.name}
                fill
                sizes="64px"
                className="object-cover"
              />
            </div>
            <div className="min-w-0">
              <h2 className="font-heading font-semibold">{hotel.name}</h2>
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <MapPin className="size-3.5" />
                {hotel.address}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Times come from the property's own policy — this line used to be
                hardcoded "from 3:00 PM / until 12:00 PM" for every hotel. */}
            <Detail icon={<CalendarDays className="size-4" />} label="Check-in">
              {formatDate(booking.checkIn)} · from {formatTime24(hotel.policies.checkInTime)}
            </Detail>
            <Detail icon={<CalendarDays className="size-4" />} label="Check-out">
              {formatDate(booking.checkOut)} · until {formatTime24(hotel.policies.checkOutTime)}
            </Detail>
            <Detail icon={<Users className="size-4" />} label="Guests">
              {booking.guests} {booking.guests === 1 ? "guest" : "guests"}
            </Detail>
            <Detail icon={<Clock className="size-4" />} label="Estimated arrival">
              {booking.arrivalTime}
            </Detail>
            <Detail
              icon={
                booking.payment.method === "card" ? (
                  <CreditCard className="size-4" />
                ) : (
                  <Building2 className="size-4" />
                )
              }
              label="Payment"
            >
              {booking.payment.method === "card" ? "Card — paid" : "Pay at the property"}
            </Detail>
            <Detail icon={<Phone className="size-4" />} label="Contact">
              {booking.guest.phone}
            </Detail>
          </div>

          {booking.specialRequests ? (
            <>
              <Separator />
              <div className="flex gap-2 text-sm">
                <MessageSquare className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">Your requests</p>
                  <p className="text-muted-foreground">{booking.specialRequests}</p>
                </div>
              </div>
            </>
          ) : null}

          <Separator />

          {/* The same breakdown the guest approved at checkout — the old page
              collapsed it into a single total, so the tax lines vanished. */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {booking.roomName} — {formatCurrency(pricing.ratePerNight)} × {pricing.nights}{" "}
                {nightLabel}
              </span>
              <span className="font-medium">{formatCurrency(pricing.roomSubtotal)}</span>
            </div>
            {pricing.discount ? (
              <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                <span>{pricing.discount.label}</span>
                <span className="font-medium">{formatCurrency(pricing.discount.amount)}</span>
              </div>
            ) : null}
            {booking.addOns.map((a) => (
              <div key={a.id} className="flex items-center justify-between">
                <span className="text-muted-foreground">{a.name}</span>
                <span className="font-medium">{formatCurrency(a.price * a.qty)}</span>
              </div>
            ))}
            {pricing.taxes.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <span className="text-muted-foreground">{t.label}</span>
                <span className="font-medium">{formatCurrency(t.amount)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex items-center justify-between text-base">
              <span className="font-heading font-semibold">Total</span>
              <span className="font-heading font-semibold">{formatCurrency(pricing.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button className="flex-1" render={<Link href="/dashboard/bookings">View My Bookings</Link>} />
        <Button
          variant="outline"
          className="flex-1"
          render={<Link href={`/hotels/${hotel.id}`}>Back to Hotel</Link>}
        />
      </div>
    </div>
  )
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-2.5">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-sm font-medium">{children}</p>
      </div>
    </div>
  )
}
