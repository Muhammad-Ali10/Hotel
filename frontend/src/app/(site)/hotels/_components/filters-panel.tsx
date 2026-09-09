"use client"

import { PROPERTY_TYPE_VALUES, type PropertyType } from "@stayora/shared"

/**
 * The API's own vocabulary, all eight of it.
 *
 * Derived from the catalogue before, which meant the panel could only ever
 * offer types that happened to be on the current page.
 */
const PROPERTY_TYPES: readonly PropertyType[] = PROPERTY_TYPE_VALUES
import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

export type Filters = {
  price: number
  /**
   * Minimum STAR rating, not review score.
   *
   * It used to be the guest review average, which the search API cannot filter
   * on — narrowing by it would have meant fetching every hotel and filtering
   * here. Stars are a property of the listing, the API takes them, and they are
   * what most hotel sites offer anyway.
   */
  minStars: number | null
  types: PropertyType[]
  amenities: string[]
}

export const defaultFilters: Filters = {
  price: 200_000,
  minStars: null,
  types: [],
  amenities: [],
}

/**
 * Star ratings, which are a property of the listing.
 *
 * This used to be review-score buckets — and the search API cannot filter on
 * those. Narrowing by review score would have meant fetching every hotel and
 * doing it in the browser, which is the thing this page just stopped doing.
 */
const starOptions = [
  { value: 5, label: "5 stars" },
  { value: 4, label: "4+ stars" },
  { value: 3, label: "3+ stars" },
]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function FiltersPanel({
  filters,
  onChange,
  className,
  amenityOptions,
  maxPrice,
}: {
  filters: Filters
  onChange: (next: Filters) => void
  className?: string
  /** Options are derived from the catalogue, so they can never offer a filter
   *  that matches nothing (the panel used to list Apartment / Villa / Boutique
   *  and room types no property had). */
  /** From the platform's controlled vocabulary, not from the current page. */
  amenityOptions: { slug: string; label: string }[]
  maxPrice: number
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between pb-1">
        <h2 className="font-heading text-lg font-semibold">Filters</h2>
        <button
          type="button"
          onClick={() => onChange({ ...defaultFilters, price: maxPrice })}
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          Reset All
        </button>
      </div>

      <Accordion
        defaultValue={["price", "rating", "types", "amenities"]}
        className="w-full"
      >
        {/* PRICE RANGE */}
        <AccordionItem value="price">
          <AccordionTrigger className="font-heading font-semibold">
            Price Range
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <Slider
              value={[filters.price]}
              min={0}
              max={maxPrice}
              step={50}
              onValueChange={(v) =>
                onChange({ ...filters, price: Array.isArray(v) ? v[0] : (v as number) })
              }
            />
            <div className="text-muted-foreground flex items-center justify-between text-sm">
              <span>$0</span>
              <span>${maxPrice}</span>
            </div>
            <p className="text-sm font-medium">Max: ${filters.price} / night</p>
          </AccordionContent>
        </AccordionItem>

        {/* GUEST RATING */}
        <AccordionItem value="rating">
          <AccordionTrigger className="font-heading font-semibold">
            Guest Rating
          </AccordionTrigger>
          <AccordionContent className="space-y-2.5">
            {starOptions.map((o) => (
              <Label key={o.value} className="gap-2.5 font-normal">
                <Checkbox
                  checked={filters.minStars === o.value}
                  onCheckedChange={() =>
                    onChange({
                      ...filters,
                      minStars: filters.minStars === o.value ? null : o.value,
                    })
                  }
                />
                <span className="font-medium">{o.label}</span>
              </Label>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* PROPERTY TYPE */}
        <AccordionItem value="types">
          <AccordionTrigger className="font-heading font-semibold">
            Property Type
          </AccordionTrigger>
          <AccordionContent className="space-y-2.5">
            {PROPERTY_TYPES.map((t) => (
              <Label key={t} className="gap-2.5 font-normal">
                <Checkbox
                  checked={filters.types.includes(t)}
                  onCheckedChange={() => onChange({ ...filters, types: toggle(filters.types, t) })}
                />
                {t}
              </Label>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* AMENITIES */}
        <AccordionItem value="amenities">
          <AccordionTrigger className="font-heading font-semibold">Amenities</AccordionTrigger>
          <AccordionContent className="space-y-2.5">
            {/* The SLUG filters and the LABEL reads (rule #74). Filtering on
                the label is how "WiFi" and "Free Wi-Fi" become two filters
                that each miss half the catalogue. */}
            {amenityOptions.map((a) => (
              <Label key={a.slug} className="gap-2.5 font-normal">
                <Checkbox
                  checked={filters.amenities.includes(a.slug)}
                  onCheckedChange={() =>
                    onChange({ ...filters, amenities: toggle(filters.amenities, a.slug) })
                  }
                />
                {a.label}
              </Label>
            ))}
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  )
}
