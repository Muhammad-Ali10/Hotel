import type { Metadata } from "next"
import Link from "next/link"

import { getHotel } from "@/data"
import { addDays, toISODate } from "@/lib/domain"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { NotFoundCard } from "@/components/shared/not-found-card"
import { CheckoutFlow } from "./_components/checkout-flow"

export const metadata: Metadata = {
  title: "Checkout — Stayora",
  description: "Complete your booking.",
}

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

  if (!hotel) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <NotFoundCard
          title="Nothing to check out"
          description="Pick a property and dates to start a booking."
          href="/hotels"
          cta="Browse hotels"
        />
      </div>
    )
  }

  const roomParam = first(sp.room)
  const roomId =
    roomParam && hotel.rooms.some((r) => r.id === roomParam) ? roomParam : hotel.rooms[0].id

  const today = toISODate(new Date())
  const checkIn = first(sp.checkin) ?? addDays(today, 1)
  const checkOut = first(sp.checkout) ?? addDays(checkIn, hotel.availability.minStay || 2)
  const guests = Number(first(sp.guests)) || 2

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/">Home</Link>} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/hotels/${hotel.id}`}>{hotel.name}</Link>} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Checkout</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="font-heading mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        Complete Your Booking
      </h1>

      <div className="mt-6">
        <CheckoutFlow
          hotelId={hotel.id}
          roomId={roomId}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
        />
      </div>
    </div>
  )
}
