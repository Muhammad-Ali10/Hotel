"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { AlertTriangle, CalendarDays, Loader2, MapPin, SlidersHorizontal, Users, X } from "lucide-react"

import type { PropertyType } from "@/types"
import { formatStay } from "@/lib/domain"
import { formatCurrency } from "@/lib/format"
import { useAmenities, useSearch } from "@/lib/api/hooks"
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
import { PropertyCard } from "@/components/marketplace/property-card"
import { FiltersPanel, type Filters } from "./filters-panel"

export type SearchCriteria = {
  city: string
  checkIn?: string
  checkOut?: string
  guests: number
}

const sortKeys: SortKey[] = ["recommended", "price-asc", "price-desc", "rating"]

/**
 * The UI's sort, in the API's words.
 *
 * `recommended` and `rating` both fall back to `price_asc`: the API sorts on
 * price and name only, and there is no relevance or review ordering to ask it
 * for. Sorting the CURRENT PAGE by rating in the browser would be worse than
 * not offering it — the top-rated hotel in the city may be on page three.
 */
const SORT_TO_API: Record<SortKey, "price_asc" | "price_desc" | "name_asc"> = {
  recommended: "price_asc",
  "price-asc": "price_asc",
  "price-desc": "price_desc",
  rating: "price_asc",
}

/** The ceiling on the price slider. Fixed, because the API pages results. */
const PRICE_CEILING = 200_000

function parseList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : []
}

export function HotelsBrowser({ criteria }: { criteria: SearchCriteria }) {
  const searchParams = useSearchParams()

  /*
   * Filters live in the URL, not in component state — a refresh, a shared
   * link or the back button used to silently drop every choice the guest made.
   */
  const filters = React.useMemo<Filters>(() => {
    const price = Number(searchParams.get("price"))
    const stars = Number(searchParams.get("stars"))
    return {
      price: Number.isFinite(price) && price > 0 ? price : PRICE_CEILING,
      minStars: Number.isFinite(stars) && stars > 0 ? stars : null,
      types: parseList(searchParams.get("types")) as PropertyType[],
      amenities: parseList(searchParams.get("amenities")),
    }
  }, [searchParams])

  const sortParam = searchParams.get("sort") as SortKey | null
  const sort: SortKey = sortParam && sortKeys.includes(sortParam) ? sortParam : "recommended"

  /*
   * The SERVER filters, not this component.
   *
   * It used to hold the whole catalogue in memory and narrow it here, which
   * worked while the catalogue was a fixture and cannot work against a real
   * one — the browser would have to download every hotel on the platform to
   * show ten.
   */
  const query = React.useMemo(
    () => ({
      city: criteria.city || undefined,
      // The API takes ONE type; the panel offers several. Sent only when the
      // guest narrowed to exactly one, which is the case it can answer.
      type: filters.types.length === 1 ? filters.types[0] : undefined,
      maxPrice: filters.price < PRICE_CEILING ? filters.price : undefined,
      minStars: filters.minStars ?? undefined,
      amenities: filters.amenities.length > 0 ? filters.amenities : undefined,

      /*
       * The dates, at last.
       *
       * This page has always HAD them — the hero search puts them in the URL
       * and the header above prints the stay — and never sent them. So the
       * list answered "hotels that match" while the guest was asking "hotels I
       * can have", and the difference only surfaced on the property page,
       * after they had chosen one.
       *
       * Both or neither: the API refuses half a range, because one date alone
       * filters nothing and would come back looking like a perfectly good
       * search over every hotel.
       */
      checkIn: criteria.checkIn && criteria.checkOut ? criteria.checkIn : undefined,
      checkOut: criteria.checkIn && criteria.checkOut ? criteria.checkOut : undefined,
      /*
       * The form asks for GUESTS, not adults and children, so everyone is
       * counted as an adult. That is the stricter reading — it requires a room
       * that fits them all in adult berths — and strict is the right direction
       * for a filter whose entire purpose is to stop showing people rooms they
       * cannot have.
       */
      adults: criteria.checkIn && criteria.checkOut ? criteria.guests : undefined,

      sort: SORT_TO_API[sort],
      limit: 24,
    }),
    [criteria.city, criteria.checkIn, criteria.checkOut, criteria.guests, filters, sort]
  )

  const { data, isLoading, isFetching, error } = useSearch(query)
  const { data: amenityVocabulary } = useAmenities()

  const results = data?.items ?? []

  /*
   * Filter options come from the platform's own vocabulary (rule #74), not
   * from whatever happens to be on this page. Deriving them from the results
   * would mean the options change every time the results do — and an amenity
   * would disappear from the panel the moment it filtered everything out.
   */
  const amenityOptions = React.useMemo(
    () => (amenityVocabulary ?? []).map((a) => ({ slug: a.slug, label: a.label })),
    [amenityVocabulary]
  )

  const commit = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      const q = params.toString()
      window.history.replaceState(null, "", q ? `?${q}` : window.location.pathname)
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
        write("price", next.price < PRICE_CEILING ? String(next.price) : null)
        write("stars", next.minStars ? String(next.minStars) : null)
        write("types", next.types.join(","))
        write("amenities", next.amenities.join(","))
      })
    },
    [commit]
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
      for (const key of ["price", "stars", "types", "amenities"]) params.delete(key)
    })
  }, [commit])

  /** What is narrowing the list, visible and undoable without opening the panel. */
  const chips = React.useMemo(() => {
    const list: { id: string; label: string; clear: () => void }[] = []
    if (filters.price < PRICE_CEILING) {
      list.push({
        id: "price",
        label: `Under ${formatCurrency(filters.price)}`,
        clear: () => setFilters({ ...filters, price: PRICE_CEILING }),
      })
    }
    if (filters.minStars !== null) {
      list.push({
        id: "stars",
        label: `${filters.minStars}+ stars`,
        clear: () => setFilters({ ...filters, minStars: null }),
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
      const label = amenityOptions.find((o) => o.slug === a)?.label ?? a
      list.push({
        id: `amenity-${a}`,
        label,
        clear: () =>
          setFilters({ ...filters, amenities: filters.amenities.filter((v) => v !== a) }),
      })
    }
    return list
  }, [filters, setFilters, amenityOptions])

  const panel = (
    <FiltersPanel
      filters={filters}
      onChange={setFilters}
      amenityOptions={amenityOptions}
      maxPrice={PRICE_CEILING}
    />
  )

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
      <aside className="hidden lg:block">{panel}</aside>

      <div className="min-w-0">
        {/* SUMMARY — what was searched, and how many came back. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
              {criteria.city ? `Stays in ${criteria.city}` : "All stays"}
            </h1>
            <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {criteria.city ? (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {criteria.city}
                </span>
              ) : null}
              {criteria.checkIn && criteria.checkOut ? (
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" />
                  {formatStay(criteria.checkIn, criteria.checkOut)}
                </span>
              ) : null}
              <span className="flex items-center gap-1">
                <Users className="size-3.5" />
                {criteria.guests} {criteria.guests === 1 ? "guest" : "guests"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* The filter panel is desktop-only; on a phone it lives in a sheet. */}
            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="outline" size="sm" className="lg:hidden">
                    <SlidersHorizontal className="size-4" />
                    Filters
                  </Button>
                }
              />
              <SheetContent side="left" className="w-[320px] overflow-y-auto p-4">
                <SheetHeader className="px-0">
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                {panel}
              </SheetContent>
            </Sheet>
            <SortSelect value={sort} onChange={setSort} />
          </div>
        </div>

        {chips.length > 0 ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <Badge key={chip.id} variant="secondary" className="gap-1 capitalize">
                {chip.label}
                <button
                  type="button"
                  onClick={chip.clear}
                  aria-label={`Remove ${chip.label} filter`}
                  className="hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Clear all
            </Button>
          </div>
        ) : null}

        {/*
          Loading is its own state, not "nothing found".
          The store was always populated so there was no in-between; over a
          network there is, and showing "no stays match" for the second before
          the response lands is a page that lies on every single load.
        */}
        {isLoading ? (
          <div className="space-y-4" aria-busy="true" aria-label="Searching">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 w-full animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : error ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              {error.message}
              {error.isRetryable ? " Try again in a moment." : null}
            </span>
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-xl border border-dashed px-6 py-16 text-center">
            <p className="font-heading text-lg font-semibold">No stays match those filters</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Try widening the price range or removing a filter.
            </p>
            {chips.length > 0 ? (
              <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
                Clear all filters
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4" aria-busy={isFetching}>
            {results.map((item) => (
              <PropertyCard key={item.id} item={item} searchId={data?.searchId ?? null} />
            ))}

            {data?.nextCursor ? (
              <p className="text-muted-foreground pt-2 text-center text-sm">
                Showing the first {results.length}. Narrow the filters to see the rest.
              </p>
            ) : null}

            {isFetching ? (
              <p className="text-muted-foreground flex items-center justify-center gap-2 pt-2 text-sm">
                <Loader2 className="size-4 animate-spin" />
                Updating…
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
