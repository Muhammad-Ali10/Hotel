"use client"

import * as React from "react"

import type { PropertyType } from "@/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
  stars: number[]
  types: PropertyType[]
  amenities: string[]
  rooms: string[]
}

export const defaultFilters: Filters = {
  price: 2000,
  stars: [],
  types: [],
  amenities: [],
  rooms: [],
}

const propertyTypes: PropertyType[] = [
  "Hotel",
  "Resort",
  "Apartment",
  "Villa",
  "Boutique",
]
const amenityOptions = [
  "WiFi",
  "Pool",
  "Spa",
  "Gym",
  "Parking",
  "Restaurant",
  "Bar",
  "Breakfast",
]
const roomTypes = ["Single", "Double", "Suite", "Family", "Penthouse"]
const starOptions = [5, 4, 3, 2, 1]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value]
}

export function FiltersPanel({
  filters,
  onChange,
  className,
}: {
  filters: Filters
  onChange: (next: Filters) => void
  className?: string
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between pb-1">
        <h2 className="font-heading text-lg font-semibold">Filters</h2>
        <button
          type="button"
          onClick={() => onChange(defaultFilters)}
          className="text-muted-foreground text-sm underline-offset-4 hover:text-foreground hover:underline"
        >
          Reset All
        </button>
      </div>

      <Accordion
        defaultValue={["price", "stars", "types", "amenities", "rooms"]}
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
              max={2000}
              step={50}
              onValueChange={(v) =>
                onChange({
                  ...filters,
                  price: Array.isArray(v) ? v[0] : (v as number),
                })
              }
            />
            <div className="text-muted-foreground flex items-center justify-between text-sm">
              <span>$0</span>
              <span>$2000</span>
            </div>
            <p className="text-sm font-medium">Max: ${filters.price} / night</p>
          </AccordionContent>
        </AccordionItem>

        {/* STAR RATING */}
        <AccordionItem value="stars">
          <AccordionTrigger className="font-heading font-semibold">
            Star Rating
          </AccordionTrigger>
          <AccordionContent className="space-y-2.5">
            {starOptions.map((s) => (
              <Label key={s} className="gap-2.5 font-normal">
                <Checkbox
                  checked={filters.stars.includes(s)}
                  onCheckedChange={() =>
                    onChange({ ...filters, stars: toggle(filters.stars, s) })
                  }
                />
                <span className="text-amber-400">{"★".repeat(s)}</span>
                <span className="text-muted-foreground">&amp; Up</span>
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
            {propertyTypes.map((t) => (
              <Label key={t} className="gap-2.5 font-normal">
                <Checkbox
                  checked={filters.types.includes(t)}
                  onCheckedChange={() =>
                    onChange({ ...filters, types: toggle(filters.types, t) })
                  }
                />
                {t}
              </Label>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* AMENITIES */}
        <AccordionItem value="amenities">
          <AccordionTrigger className="font-heading font-semibold">
            Amenities
          </AccordionTrigger>
          <AccordionContent className="space-y-2.5">
            {amenityOptions.map((a) => (
              <Label key={a} className="gap-2.5 font-normal">
                <Checkbox
                  checked={filters.amenities.includes(a)}
                  onCheckedChange={() =>
                    onChange({
                      ...filters,
                      amenities: toggle(filters.amenities, a),
                    })
                  }
                />
                {a}
              </Label>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* ROOM TYPE */}
        <AccordionItem value="rooms">
          <AccordionTrigger className="font-heading font-semibold">
            Room Type
          </AccordionTrigger>
          <AccordionContent className="space-y-2.5">
            {roomTypes.map((r) => (
              <Label key={r} className="gap-2.5 font-normal">
                <Checkbox
                  checked={filters.rooms.includes(r)}
                  onCheckedChange={() =>
                    onChange({ ...filters, rooms: toggle(filters.rooms, r) })
                  }
                />
                {r}
              </Label>
            ))}
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Button
        variant="outline"
        className="mt-2 w-full"
        onClick={() => onChange(defaultFilters)}
      >
        Reset All
      </Button>
    </div>
  )
}
