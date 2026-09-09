"use client"

import Link from "next/link"
import Image from "next/image"

import type { PropertySearchInput } from "@stayora/shared"
import { destinationImage } from "@/lib/images"
import { formatCurrency } from "@/lib/format"
import { useDestinations, useSearch } from "@/lib/api/hooks"
import { PropertyCard } from "@/components/marketplace/property-card"

/**
 * The home page's property strips and destination cards.
 *
 * Everything here used to be a slice of a catalogue held in the browser, and
 * three of the sections could not survive contact with a real one:
 *
 *   - **"Top Rated"** sorted by nothing. The search API has no rating sort —
 *     it has `recommended`, which IS the ranking, and rating is one of the
 *     five factors inside it (rule #104). So the strip says what it shows.
 *   - **"Special Offers"** was four hotels picked from a list. Nothing marks a
 *     property as discounted — a promotion belongs to a rate plan and a date
 *     range — so the section had no query behind it and is gone.
 *   - **"Popular Destinations"** claimed 342 properties in Dubai. The
 *     marketplace has eight. The counts now come from a grouped query over
 *     live properties, so the number on the card is the number of hotels
 *     behind it.
 */

function Strip({
  query,
  emptyMessage,
}: {
  query: Partial<PropertySearchInput>
  emptyMessage: string
}) {
  const { data, isPending, error } = useSearch(query)
  const items = data?.items ?? []

  if (isPending) {
    return (
      <div
        className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        aria-busy="true"
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-muted h-80 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (error || items.length === 0) {
    return <p className="text-muted-foreground text-sm">{emptyMessage}</p>
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <PropertyCard key={item.id} item={item} />
      ))}
    </div>
  )
}

/** What search itself would put first — the ranking, not a hand-picked four. */
export function RecommendedStrip() {
  return (
    <Strip
      query={{ sort: "recommended", limit: 4 }}
      emptyMessage="Nothing listed yet. The first properties appear here as they go live."
    />
  )
}

/** Five stars, which is a fact about the property rather than a curation. */
export function LuxuryStrip() {
  return (
    <Strip
      query={{ minStars: 5, sort: "recommended", limit: 4 }}
      emptyMessage="No five-star properties are live yet."
    />
  )
}

export function DestinationGrid() {
  const { data, isPending } = useDestinations(8)

  if (isPending) {
    return (
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-muted aspect-4/5 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  const destinations = data ?? []

  if (destinations.length === 0) {
    return (
      <p className="text-muted-foreground mt-8 text-sm">
        No cities yet — they appear as properties go live.
      </p>
    )
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
      {destinations.map((destination) => (
        <Link
          key={`${destination.city}-${destination.country}`}
          href={`/hotels?city=${encodeURIComponent(destination.city)}`}
          className="group relative aspect-4/5 overflow-hidden rounded-xl"
        >
          <Image
            src={destinationImage(destination.city, 400, 500)}
            alt={destination.city}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-0 p-4 text-white">
            <p className="font-heading text-lg font-semibold">{destination.city}</p>
            <p className="text-sm text-white/80">
              {destination.properties}{" "}
              {destination.properties === 1 ? "property" : "properties"}
              {destination.fromPrice > 0
                ? ` · from ${formatCurrency(destination.fromPrice)}`
                : ""}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}
