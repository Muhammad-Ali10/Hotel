"use client"

import type { PropertyType } from "@/types"
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
  /** minimum review score, e.g. 4.5 */
  minRating: number | null
  types: PropertyType[]
  amenities: string[]
  rooms: string[]
}

export const defaultFilters: Filters = {
  price: 2000,
  minRating: null,
  types: [],
  amenities: [],
  rooms: [],
}

/**
 * Score buckets, not star counts. Every hotel scores between 3.9 and 5.0, so
 * the old "5 stars" checkbox could never match anything — `Math.floor(4.9)` is
 * 4, and no property was ever going to floor to 5.
 */
const ratingOptions = [
  { value: 4.5, label: "4.5+", caption: "Exceptional" },
  { value: 4, label: "4.0+", caption: "Excellent" },
  { value: 3.5, label: "3.5+", caption: "Very good" },
  { value: 3, label: "3.0+", caption: "Good" },
]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function FiltersPanel({
  filters,
  onChange,
  className,
  typeOptions,
  amenityOptions,
  roomOptions,
  maxPrice,
}: {
  filters: Filters
  onChange: (next: Filters) => void
  className?: string
  /** Options are derived from the catalogue, so they can never offer a filter
   *  that matches nothing (the panel used to list Apartment / Villa / Boutique
   *  and room types no property had). */
  typeOptions: PropertyType[]
  amenityOptions: string[]
  roomOptions: string[]
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
        defaultValue={["price", "rating", "types", "amenities", "rooms"]}
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
            {ratingOptions.map((o) => (
              <Label key={o.value} className="gap-2.5 font-normal">
                <Checkbox
                  checked={filters.minRating === o.value}
                  onCheckedChange={() =>
                    onChange({
                      ...filters,
                      minRating: filters.minRating === o.value ? null : o.value,
                    })
                  }
                />
                <span className="font-medium">{o.label}</span>
                <span className="text-muted-foreground">{o.caption}</span>
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
            {typeOptions.map((t) => (
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
            {amenityOptions.map((a) => (
              <Label key={a} className="gap-2.5 font-normal">
                <Checkbox
                  checked={filters.amenities.includes(a)}
                  onCheckedChange={() =>
                    onChange({ ...filters, amenities: toggle(filters.amenities, a) })
                  }
                />
                {a}
              </Label>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* ROOM TYPE */}
        <AccordionItem value="rooms">
          <AccordionTrigger className="font-heading font-semibold">Room Type</AccordionTrigger>
          <AccordionContent className="space-y-2.5">
            {roomOptions.map((r) => (
              <Label key={r} className="gap-2.5 font-normal">
                <Checkbox
                  checked={filters.rooms.includes(r)}
                  onCheckedChange={() => onChange({ ...filters, rooms: toggle(filters.rooms, r) })}
                />
                {r}
              </Label>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
