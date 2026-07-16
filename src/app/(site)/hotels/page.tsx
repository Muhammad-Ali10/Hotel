import type { Metadata } from "next"

import { HeroSearch } from "@/components/marketplace/hero-search"
import { HotelsBrowser } from "./_components/hotels-browser"

export const metadata: Metadata = {
  title: "Hotels — Stayora",
  description: "Browse and filter luxury hotels and resorts.",
}

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string
    checkin?: string
    checkout?: string
    guests?: string
  }>
}) {
  const { city, checkin, checkout, guests } = await searchParams
  const criteria = {
    city: city?.trim() ?? "",
    checkIn: checkin,
    checkOut: checkout,
    guests: Number(guests) || 2,
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {/* SEARCH BAR — prefilled from the query so the results and the field agree */}
      <HeroSearch
        initialLocation={criteria.city}
        initialCheckIn={criteria.checkIn}
        initialCheckOut={criteria.checkOut}
        initialGuests={criteria.guests}
        glow={false}
        className="max-w-none"
      />

      {/* PAGE HEAD + LAYOUT (filters + results) */}
      <div className="mt-8">
        <HotelsBrowser criteria={criteria} />
      </div>
    </div>
  )
}
