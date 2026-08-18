"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { CalendarDays, MapPin, SlidersHorizontal, Users, X } from "lucide-react"

import type { PropertyType } from "@/types"
import { checkHotelAvailability, formatStay } from "@/lib/domain"
import { formatCurrency } from "@/lib/format"
import { useStore } from "@/store"
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
import { FiltersPanel, type Filters } from "./filters-panel"

export type SearchCriteria = {
  city: string
  checkIn?: string
  checkOut?: string
  guests: number
}

const sortKeys: SortKey[] = ["recommended", "price-asc", "price-desc", "rating"]

function parseList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : []
}

export function HotelsBrowser({ criteria }: { criteria: SearchCriteria }) {
  const allHotels = useHotels()
  const ratings = useRatings()
  const bookings = useStore((s) => s.bookings)
  const searchParams = useSearchParams()

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

  /**
   * Filters live in the URL, not in component state. Previously they were
   * `useState` only, so a refresh, a shared link or the back button silently
   * dropped every choice the guest had made.
   */
  const filters = React.useMemo<Filters>(() => {
    const price = Number(searchParams.get("price"))
    const rating = Number(searchParams.get("rating"))
    return {
      price: Number.isFinite(price) && price > 0 ? price : maxPrice,
      minRating: Number.isFinite(rating) && rating > 0 ? rating : null,
      types: parseList(searchParams.get("types")) as PropertyType[],
      amenities: parseList(searchParams.get("amenities")),
      rooms: parseList(searchParams.get("rooms")),
    }
  }, [searchParams, maxPrice])

  const sortParam = searchParams.get("sort") as SortKey | null
  const sort: SortKey = sortParam && sortKeys.includes(sortParam) ? sortParam : "recommended"

  /**
   * `replaceState` keeps the URL in step without a server round-trip and
   * without pushing a history entry for every checkbox — Next syncs it back
   * through `useSearchParams`.
   */
  const commit = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      const query = params.toString()
      window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname)
    },
    [searchParams]
  )

  const setFilters = React.useCallback(
    (next: Filters) => {
      commit((params) => {
        const write = (key: string, value: string | null) => {
          if (value) params.set(key, value)
          else params.delete(key)
        }
        write("price", next.price < maxPrice ? String(next.price) : null)
        write("rating", next.minRating ? String(next.minRating) : null)
        write("types", next.types.join(","))
        write("amenities", next.amenities.join(","))
        write("rooms", next.rooms.join(","))
      })
    },
    [commit, maxPrice]
  )

  const setSort = React.useCallback(
    (next: SortKey) => {
      commit((params) => {
        if (next === "recommended") params.delete("sort")
        else params.set("sort", next)
      })
    },
    [commit]
  )

  const resetFilters = React.useCallback(() => {
    commit((params) => {
      for (const key of ["price", "rating", "types", "amenities", "rooms"]) {
        params.delete(key)
      }
    })
  }, [commit])

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

  /** What's currently narrowing the list, so it can be seen and undone without
   *  opening the panel — on mobile the panel is behind a sheet. */
  const chips = React.useMemo(() => {
    const list: { id: string; label: string; clear: () => void }[] = []
    if (filters.price < maxPrice) {
      list.push({
        id: "price",
        label: `Under ${formatCurrency(filters.price)}`,
        clear: () => setFilters({ ...filters, price: maxPrice }),
      })
    }
    if (filters.minRating !== null) {
      list.push({
        id: "rating",
        label: `${filters.minRating}+ rating`,
        clear: () => setFilters({ ...filters, minRating: null }),
      })
    }
    for (const t of filters.types) {
      list.push({
        id: `type-${t}`,
        label: t,
        clear: () => setFilters({ ...filters, types: filters.types.filter((v) => v !== t) }),
      })
    }
    for (const a of filters.amenities) {
      list.push({
        id: `amenity-${a}`,
        label: a,
        clear: () =>
          setFilters({ ...filters, amenities: filters.amenities.filter((v) => v !== a) }),
      })
    }
    for (const r of filters.rooms) {
      list.push({
        id: `room-${r}`,
        label: r,
        clear: () => setFilters({ ...filters, rooms: filters.rooms.filter((v) => v !== r) }),
      })
    }
    return list
  }, [filters, maxPrice, setFilters])

  const panelProps = { typeOptions, amenityOptions, roomOptions, maxPrice }
  const hasDates = Boolean(criteria.checkIn && criteria.checkOut)

  return (
    <>
      {/* SEARCH SUMMARY — proof that the dates and party size survived the
          search, and, once the search bar has scrolled away, the way back to
          it. The bar used to scroll off with the results and leave no way to
          change the search without going back to the top by hand. */}
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-26 z-30 -mx-4 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 text-sm backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <span className="text-muted-foreground flex items-center gap-1.5">
          <MapPin className="size-3.5" />
          {criteria.city || "All destinations"}
        </span>
        <span className="text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="size-3.5" />
          {hasDates ? formatStay(criteria.checkIn!, criteria.checkOut!) : "Any dates"}
        </span>
        <span className="text-muted-foreground flex items-center gap-1.5">
          <Users className="size-3.5" />
          {criteria.guests} {criteria.guests === 1 ? "guest" : "guests"}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          render={<a href="#search">Change search</a>}
        />
      </div>

      {/* PAGE HEAD */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {criteria.city ? `Hotels in ${criteria.city}` : "All hotels"}
          </h1>
          <p className="text-muted-foreground mt-1" aria-live="polite">
            Showing {results.length} of {cityHotels.length}{" "}
            {cityHotels.length === 1 ? "property" : "properties"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile filter trigger — a bottom sheet, which is where a thumb is */}
          <Sheet>
            <SheetTrigger
              render={
                <Button variant="outline" size="default" className="lg:hidden">
                  <SlidersHorizontal className="size-4" />
                  Filters
                  {chips.length > 0 ? (
                    <Badge className="ml-1 tabular-nums">{chips.length}</Badge>
                  ) : null}
                </Button>
              }
            />
            <SheetContent
              side="bottom"
              className="max-h-[85dvh] overflow-y-auto rounded-t-2xl p-4"
            >
              <SheetHeader className="px-0 pt-0">
                <SheetTitle className="sr-only">Filters</SheetTitle>
              </SheetHeader>
              <FiltersPanel filters={filters} onChange={setFilters} {...panelProps} />
            </SheetContent>
          </Sheet>
          <SortSelect value={sort} onChange={setSort} />
        </div>
      </div>

      {/* ACTIVE FILTERS */}
      {chips.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.clear}
              aria-label={`Remove filter: ${chip.label}`}
              className="bg-muted hover:bg-muted-foreground/15 text-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-colors"
            >
              {chip.label}
              <X className="size-3.5" />
            </button>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="text-muted-foreground hover:text-foreground px-1 text-sm underline-offset-4 hover:underline"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {/* LAYOUT */}
      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* FILTERS (desktop) */}
        <aside className="hidden w-72 shrink-0 lg:block">
          {/* clears the header (~105px) plus the sticky summary bar above */}
          <div className="bg-card sticky top-40 rounded-xl border p-5">
            <FiltersPanel filters={filters} onChange={setFilters} {...panelProps} />
          </div>
        </aside>

        {/* RESULTS */}
        <div className="min-w-0 flex-1">
          {results.length > 0 ? (
            <div className="flex flex-col gap-5">
              {results.map((hotel) => {
                // Open/close calendar, min-stay rule, and whether any room type
                // actually has units left for those dates.
                const stay = hasDates
                  ? checkHotelAvailability(
                      hotel,
                      bookings,
                      criteria.checkIn!,
                      criteria.checkOut!
                    )
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
                      <ResultCard
                        hotel={hotel}
                        checkIn={stay.ok ? criteria.checkIn : undefined}
                        checkOut={stay.ok ? criteria.checkOut : undefined}
                        guests={criteria.guests}
                      />
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
                {chips.length > 0
                  ? "Try removing a filter to widen the search."
                  : "Try a different destination or adjust your dates."}
              </p>
              <Button variant="outline" className="mt-4" onClick={resetFilters}>
                Reset All
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
