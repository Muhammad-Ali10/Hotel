import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CreditCard,
  MapPin,
  Users,
} from "lucide-react"

import { getHotel } from "@/data"
import { formatCurrency, formatDate } from "@/lib/format"
import { hotelImage } from "@/lib/images"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PrintButton } from "./_components/print-button"

const TAX_RATE = 0.12

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const hotel = getHotel(first(sp.hotel) ?? "")

  const roomParam = first(sp.room)
  const room =
    hotel.rooms.find((r) => r.id === roomParam) ?? hotel.rooms[0]
  const checkIn = first(sp.checkin) ?? "2026-06-25"
  const checkOut = first(sp.checkout) ?? "2026-06-27"
  const guests = first(sp.guests) ?? "2-1"
  const reference = first(sp.ref) ?? "STY-XXXXXX"
  const name = first(sp.name) ?? ""
  const email = first(sp.email) ?? ""
  const pay = first(sp.pay) ?? "card"

  const [g, r] = guests.split("-")
  const guestsLabel = `${g} ${Number(g) === 1 ? "Guest" : "Guests"}, ${r} ${Number(r) === 1 ? "Room" : "Rooms"}`

  const diff =
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000
  const nights = Number.isFinite(diff) && diff > 0 ? Math.round(diff) : 1
  const subtotal = room.pricePerNight * nights
  const total = subtotal + Math.round(subtotal * TAX_RATE)

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
          {name ? `Thank you, ${name}. ` : ""}Your reservation at{" "}
          <span className="text-foreground font-medium">{hotel.name}</span> is
          confirmed.
          {email ? ` A confirmation email has been sent to ${email}.` : ""}
        </p>
      </div>

      {/* REFERENCE */}
      <div className="bg-muted/50 mt-8 flex items-center justify-between gap-4 rounded-xl border px-5 py-4">
        <div>
          <p className="text-muted-foreground text-xs">Booking reference</p>
          <p className="font-heading text-lg font-semibold tracking-wider">
            {reference}
          </p>
        </div>
        <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 rounded-full px-3 py-1 text-xs font-medium">
          {pay === "card" ? "Paid" : "Confirmed"}
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
                {hotel.city}, {hotel.country}
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Detail icon={<CalendarDays className="size-4" />} label="Check-in">
              {formatDate(checkIn)} · from 3:00 PM
            </Detail>
            <Detail icon={<CalendarDays className="size-4" />} label="Check-out">
              {formatDate(checkOut)} · until 12:00 PM
            </Detail>
            <Detail icon={<Users className="size-4" />} label="Guests">
              {guestsLabel}
            </Detail>
            <Detail
              icon={
                pay === "card" ? (
                  <CreditCard className="size-4" />
                ) : (
                  <Building2 className="size-4" />
                )
              }
              label="Payment"
            >
              {pay === "card" ? "Credit / Debit Card" : "Pay at Property"}
            </Detail>
            <Detail label="Room">
              {room.name} · {nights} {nights === 1 ? "night" : "nights"}
            </Detail>
            <Detail label="Total">
              <span className="font-heading text-base font-semibold">
                {formatCurrency(total)}
              </span>
            </Detail>
          </div>
        </CardContent>
      </Card>

      {/* ACTIONS */}
      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button
          size="lg"
          render={
            <Link href="/dashboard/bookings">
              View My Bookings
              <ArrowRight className="size-4" />
            </Link>
          }
        />
        <Button
          variant="outline"
          size="lg"
          render={<Link href="/hotels">Explore More Hotels</Link>}
        />
        <PrintButton />
      </div>
    </div>
  )
}

function Detail({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      {icon ? (
        <span className="text-muted-foreground mt-0.5">{icon}</span>
      ) : null}
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-sm font-medium">{children}</p>
      </div>
    </div>
  )
}
