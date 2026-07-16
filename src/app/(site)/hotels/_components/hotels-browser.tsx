"use client"

import * as React from "react"
import { CalendarDays, MapPin, SlidersHorizontal, Users } from "lucide-react"

import type { PropertyType } from "@/types"
import { checkStay, formatStay } from "@/lib/domain"
import { useHotels, useRatings } from "@/store/selectors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SortSelect, type SortKey } from "./sort-select"
import { ResultCard } from "./result-card"
import { FiltersPanel, defaultFilters, type Filters } from "./filters-panel"

export type SearchCriteria = {
  city: string
  checkIn?: string
  checkOut?: string
  guests: number
}

export function HotelsBrowser({ criteria }: { criteria: SearchCriteria }) {
  const allHotels = useHotels()
  const ratings = useRatings()

  // Filter options come from the catalogue itself, so the panel can never offer
  // a choice that matches nothing.
  const { typeOptions, amenityOptions, roomOptions, maxPrice } = React.useMemo(() => {
    const types = new Set<PropertyType>()
    const amenities = new Set<string>()
    const rooms = new Set<string>()
    let max = 0
    for (const h of allHotels) {
      types.add(h.type)
      h.amenities.forEach((a) => amenities.add(a))
      h.rooms.forEach((r) => rooms.add(r.name))
      max = Math.max(max, ...h.rooms.map((r) => r.pricePerNight))
    }
    return {
      typeOptions: [...types].sort(),
      amenityOptions: [...amenities].sort(),
      roomOptions: [...rooms].sort(),
      maxPrice: Math.ceil(max / 500) * 500,
    }
  }, [allHotels])

  const [filters, setFilters] = React.useState<Filters>(() => ({
    ...defaultFilters,
    price: maxPrice,
  }))
  const [sort, setSort] = React.useState<SortKey>("recommended")

  const cityHotels = React.useMemo(
    () =>
      criteria.city
        ? allHotels.filter((h) => h.city.toLowerCase() === criteria.city.toLowerCase())
        : allHotels,
    [allHotels, criteria.city]
  )

  const results = React.useMemo(() => {
    const filtered = cityHotels.filter((h) => {
      if (h.pricePerNight > filters.price) return false
      if (filters.minRating !== null && (ratings[h.id]?.rating ?? 0) < filters.minRating)
        return false
      if (filters.types.length > 0 && !filters.types.includes(h.type)) return false
      if (filters.amenities.length > 0 && !filters.amenities.every((a) => h.amenities.includes(a)))
        return false
      // The room filter was collected but never applied — a hotel now has to
      // actually offer one of the selected room types.
      if (
        filters.rooms.length > 0 &&
        !filters.rooms.some((name) => h.rooms.some((r) => r.name === name))
      )
        return false
      return true
    })

    const sorted = [...filtered]
    switch (sort) {
      case "price-asc":
        sorted.sort((a, b) => a.pricePerNight - b.pricePerNight)
        break
      case "price-desc":
        sorted.sort((a, b) => b.pricePerNight - a.pricePerNight)
        break
      case "rating":
        sorted.sort((a, b) => (ratings[b.id]?.rating ?? 0) - (ratings[a.id]?.rating ?? 0))
        break
      default:
        break
    }
    return sorted
  }, [cityHotels, filters, sort, ratings])

  const panelProps = { typeOptions, amenityOptions, roomOptions, maxPrice }
  const hasDates = Boolean(criteria.checkIn && criteria.checkOut)

  return (
    <>
      {/* SEARCH SUMMARY — proof that the dates and party size survived the search */}
      {hasDates || criteria.city ? (
        <div className="text-muted-foreground mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {criteria.city ? (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5" />
              {criteria.city}
            </span>
          ) : null}
          {hasDates ? (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {formatStay(criteria.checkIn!, criteria.checkOut!)}
            </span>
          ) : null}
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" />
            {criteria.guests} {criteria.guests === 1 ? "guest" : "guests"}
          </span>
        </div>
      ) : null}

      {/* PAGE HEAD */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {criteria.city ? `Hotels in ${criteria.city}` : "All hotels"}
          </h1>
          <p className="text-muted-foreground mt-1">
            Showing {results.length} of {cityHotels.length} results
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile filter trigger */}
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" size="default" className="lg:hidden">
                  <SlidersHorizontal className="size-4" />
                  Filters
                </Button>
              }
            />
            <SheetContent side="left" className="w-[88%] max-w-sm overflow-y-auto p-4">
              <SheetHeader className="px-0 pt-0">
                <SheetTitle className="sr-only">Filters</SheetTitle>
              </SheetHeader>
              <FiltersPanel filters={filters} onChange={setFilters} {...panelProps} />
            </SheetContent>
          </Sheet>
          <SortSelect value={sort} onChange={setSort} />
        </div>
      </div>

      {/* LAYOUT */}
      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* FILTERS (desktop) */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="bg-card sticky top-24 rounded-xl border p-5">
            <FiltersPanel filters={filters} onChange={setFilters} {...panelProps} />
          </div>
        </aside>

        {/* RESULTS */}
        <div className="min-w-0 flex-1">
          {results.length > 0 ? (
            <div className="flex flex-col gap-5">
              {results.map((hotel) => {
                // Honours the partner's open/close calendar and min-stay rule.
                const stay = hasDates
                  ? checkStay(hotel.availability, criteria.checkIn!, criteria.checkOut!)
                  : { ok: true as const }
                return (
                  <div key={hotel.id} className="relative">
                    {!stay.ok ? (
                      <Badge
                        variant="secondary"
                        className="absolute top-3 left-1/2 z-10 -translate-x-1/2 shadow-sm"
                      >
                        {stay.reason === "minStay"
                          ? `${hotel.availability.minStay}-night minimum`
                          : "Sold out for your dates"}
                      </Badge>
                    ) : null}
                    <div className={stay.ok ? undefined : "opacity-60 grayscale"}>
                      <ResultCard hotel={hotel} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-muted/30 rounded-xl border border-dashed p-12 text-center">
              <p className="font-heading text-lg font-semibold">
                No hotels match your filters
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Try adjusting or resetting your filters.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setFilters({ ...defaultFilters, price: maxPrice })}
              >
                Reset All
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
