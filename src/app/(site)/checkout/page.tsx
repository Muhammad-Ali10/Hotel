import Link from "next/link"

import { getHotel } from "@/data"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { CheckoutFlow } from "./_components/checkout-flow"

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
  const roomId =
    roomParam && hotel.rooms.some((r) => r.id === roomParam)
      ? roomParam
      : hotel.rooms[0].id
  const checkIn = first(sp.checkin) ?? "2026-06-25"
  const checkOut = first(sp.checkout) ?? "2026-06-27"
  const guests = first(sp.guests) ?? "2-1"

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/">Home</Link>} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link href={`/hotels/${hotel.id}`}>{hotel.name}</Link>}
            />
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
          hotel={hotel}
          roomId={roomId}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
        />
      </div>
    </div>
  )
}
