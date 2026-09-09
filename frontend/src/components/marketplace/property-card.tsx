"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { MapPin } from "lucide-react"

import type { PropertyListItem } from "@stayora/shared"
import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatNumber } from "@/lib/format"
import { catalogApi } from "@/lib/api/endpoints"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { StarRating } from "@/components/marketplace/star-rating"
import { FavoriteButton } from "@/components/marketplace/favorite-button"
import { AmenityIcon } from "@/components/marketplace/amenity-icon"

/**
 * One property card.
 *
 * The single card in the product. There used to be two — this one, over the
 * API's own `PropertyListItem`, and a `HotelCard` that read a rating out of a
 * browser store. The home page used the second, so the same hotel could show
 * one score on the front page and another on the search results.
 *
 * Shows a "from" price per night, and NOT an all-in total for the searched
 * dates. It used to compute that total with `priceBooking()`, which is a
 * second implementation of the server's pricing — and once the catalogue went
 * live it became a wrong one: it read per-night rates from a client-side cache
 * that no longer exists and never applied a promotion.
 *
 * A dates-aware search price is a real feature and it needs the API: the
 * search endpoint takes no dates, so nothing here can honestly quote a stay.
 * The detail page asks for a real quote, and that is where the number a guest
 * pays comes from.
 */
export function PropertyCard({
  item,
  searchId,
}: {
  item: PropertyListItem
  /** For recording which result was opened (rule #67). */
  searchId?: string | null
}) {
  const chips = item.amenities.slice(0, 5)
  const rating = item.rating

  /*
   * Reported when the guest opens this result, not when the card renders.
   *
   * An impression is being SHOWN; a click is being chosen. Recording the click
   * on render would make every conversion figure 100%.
   */
  const recordClick = React.useCallback(() => {
    if (searchId) void catalogApi.reportClick(searchId, item.id)
  }, [searchId, item.id])

  return (
    <Card className="group grid grid-cols-1 gap-0 p-0 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr]">
      {/* IMAGE */}
      <div className="relative aspect-[4/3] w-full overflow-hidden md:aspect-auto md:h-full">
        <Image
          src={placeholderImage(item.seed, 600, 450)}
          alt={item.name}
          fill
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Same badge arrangement as HotelCard: type left, offer + save right. */}
        <Badge className="absolute top-3 left-3" variant="secondary">
          {item.type}
        </Badge>
        <div className="absolute top-3 right-3 flex items-center gap-2">
          
          {/* The property's id, not its slug: the saved list is keyed on the
              row, and a slug can be regenerated. This used to pass the slug. */}
          <FavoriteButton
            propertyId={item.id}
            propertyName={item.name}
            className="bg-background/80 hover:bg-background"
          />
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="space-y-1">
          <h3 className="font-heading text-lg leading-tight font-semibold">{item.name}</h3>
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <MapPin className="size-3.5" />
            {item.city}, {item.country}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          {rating.reviewCount > 0 ? (
            <>
              <StarRating rating={rating.rating} size="size-3.5" />
              <span className="font-medium">{rating.rating}</span>
              <span className="text-muted-foreground">
                ({formatNumber(rating.reviewCount)}{" "}
                {rating.reviewCount === 1 ? "review" : "reviews"})
              </span>
            </>
          ) : (
            <span className="text-muted-foreground">No reviews yet</span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {chips.map((a) => (
            <span
              key={a}
              className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs"
            >
              <AmenityIcon amenity={a} className="size-3" />
              {a}
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground text-sm">from</span>
              <span className="font-heading text-xl font-semibold">
                {formatCurrency(item.fromPrice)}
              </span>
              <span className="text-muted-foreground text-sm">/ night</span>
            </div>
            {/* No total for the dates: the search endpoint takes none, so
                nothing here can honestly quote a stay. The detail page asks
                the server for a real price. */}
            <p className="text-muted-foreground mt-0.5 text-sm">
              Final price shown when you pick your dates
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/hotels/${item.slug}`} onClick={recordClick}>View Details</Link>}
            />
            <Button size="sm" render={<Link href={`/hotels/${item.slug}#reserve`} onClick={recordClick}>Book Now</Link>} />
          </div>
        </div>
      </div>
    </Card>
  )
}
