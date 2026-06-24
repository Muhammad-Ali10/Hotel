"use client"

import * as React from "react"
import { SlidersHorizontal } from "lucide-react"

import type { Hotel } from "@/types"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { SortSelect } from "./sort-select"
import { ResultCard } from "./result-card"
import {
  FiltersPanel,
  defaultFilters,
  type Filters,
} from "./filters-panel"

export function HotelsBrowser({
  hotels,
  city,
}: {
  hotels: Hotel[]
  city: string
}) {
  const [filters, setFilters] = React.useState<Filters>(defaultFilters)

  const results = React.useMemo(() => {
    return hotels.filter((h) => {
      if (h.pricePerNight > filters.price) return false
      if (
        filters.stars.length > 0 &&
        !filters.stars.some((s) => Math.floor(h.rating) >= s)
      )
        return false
      if (filters.types.length > 0 && !filters.types.includes(h.type))
        return false
      if (
        filters.amenities.length > 0 &&
        !filters.amenities.every((a) => h.amenities.includes(a))
      )
        return false
      return true
    })
  }, [hotels, filters])

  return (
    <>
      {/* PAGE HEAD */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Hotels in {city}
          </h1>
          <p className="text-muted-foreground mt-1">
            Showing {results.length} of {hotels.length} results
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
              <FiltersPanel filters={filters} onChange={setFilters} />
            </SheetContent>
          </Sheet>
          <SortSelect />
        </div>
      </div>

      {/* LAYOUT */}
      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* FILTERS (desktop) */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="bg-card sticky top-24 rounded-xl border p-5">
            <FiltersPanel filters={filters} onChange={setFilters} />
          </div>
        </aside>

        {/* RESULTS */}
        <div className="min-w-0 flex-1">
          {results.length > 0 ? (
            <div className="flex flex-col gap-5">
              {results.map((hotel) => (
                <ResultCard key={hotel.id} hotel={hotel} />
              ))}
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
                onClick={() => setFilters(defaultFilters)}
              >
                Reset All
              </Button>
            </div>
          )}

          {results.length > 0 ? (
            <div className="mt-8 flex justify-center">
              <Button variant="outline" size="lg">
                ↻ Load More
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  )
}
