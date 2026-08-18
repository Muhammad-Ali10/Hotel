"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { MapPin } from "lucide-react"

import type { Hotel } from "@/types"
import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatNumber } from "@/lib/format"
import { originalPrice, priceBooking } from "@/lib/domain"
import { useHotelRating } from "@/store/selectors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { StarRating } from "@/components/marketplace/star-rating"
import { FavoriteButton } from "@/components/marketplace/favorite-button"
import { DiscountBadge } from "@/components/marketplace/discount-badge"
import { AmenityIcon } from "@/components/marketplace/amenity-icon"

export function ResultCard({
  hotel,
  checkIn,
  checkOut,
  guests = 2,
}: {
  hotel: Hotel
  checkIn?: string
  checkOut?: string
  guests?: number
}) {
  const chips = hotel.amenities.slice(0, 5)
  const rating = useHotelRating(hotel.id)
  const strikethrough = originalPrice(hotel)

  /**
   * The all-in total for the dates being searched. Cards used to quote a
   * nightly rate only, which is the number shoppers compare least — priced
   * through the same `priceBooking` the reserve card and the invoice use, on
   * the cheapest room (the one `hotel.pricePerNight` already represents).
   */
  const stay = React.useMemo(() => {
    if (!checkIn || !checkOut || hotel.rooms.length === 0) return null
    const cheapest = hotel.rooms.reduce((min, r) =>
      r.pricePerNight < min.pricePerNight ? r : min
    )
    const pricing = priceBooking({
      hotel,
      room: cheapest,
      checkIn,
      checkOut,
      guests,
    })
    return pricing.nights > 0 ? pricing : null
  }, [hotel, checkIn, checkOut, guests])

  return (
    <Card className="group grid grid-cols-1 gap-0 p-0 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr]">
      {/* IMAGE */}
      <div className="relative aspect-[4/3] w-full overflow-hidden md:aspect-auto md:h-full">
        <Image
          src={placeholderImage(hotel.seed, 600, 450)}
          alt={hotel.name}
          fill
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Same badge arrangement as HotelCard: type left, offer + save right. */}
        <Badge className="absolute top-3 left-3" variant="secondary">
          {hotel.type}
        </Badge>
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {hotel.discount ? <DiscountBadge discount={hotel.discount} /> : null}
          <FavoriteButton
            hotelId={hotel.id}
            hotelName={hotel.name}
            className="bg-background/80 hover:bg-background"
          />
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="space-y-1">
          <h3 className="font-heading text-lg leading-tight font-semibold">{hotel.name}</h3>
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <MapPin className="size-3.5" />
            {hotel.city}, {hotel.country}
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
              {strikethrough ? (
                <span className="text-muted-foreground text-sm line-through">
                  {formatCurrency(strikethrough)}
                </span>
              ) : null}
              <span className="font-heading text-xl font-semibold">
                {formatCurrency(hotel.pricePerNight)}
              </span>
              <span className="text-muted-foreground text-sm">/ night</span>
            </div>
            {stay ? (
              <p className="text-muted-foreground mt-0.5 text-sm">
                <span className="text-foreground font-medium">
                  {formatCurrency(stay.total)} total
                </span>
                {` for ${stay.nights} ${stay.nights === 1 ? "night" : "nights"} · incl. taxes & fees`}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href={`/hotels/${hotel.id}`}>View Details</Link>}
            />
            <Button size="sm" render={<Link href={`/hotels/${hotel.id}#reserve`}>Book Now</Link>} />
          </div>
        </div>
      </div>
    </Card>
  )
}
