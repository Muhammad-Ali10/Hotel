"use client"

import Link from "next/link"
import Image from "next/image"
import { MapPin, Star } from "lucide-react"

import type { Hotel } from "@/types"
import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatNumber } from "@/lib/format"
import { formatDiscount, originalPrice } from "@/lib/domain"
import { useHotelRating } from "@/store/selectors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { StarRating } from "@/components/marketplace/star-rating"
import { FavoriteButton } from "@/components/marketplace/favorite-button"

const amenityIcons: Record<string, string> = {
  WiFi: "📶",
  Pool: "🏊",
  Spa: "💆",
  Gym: "🏋",
  Parking: "🅿",
  Restaurant: "🍴",
  Bar: "🍸",
  Breakfast: "🍳",
  Beach: "🏖",
}

export function ResultCard({ hotel }: { hotel: Hotel }) {
  const chips = hotel.amenities.slice(0, 5)
  const rating = useHotelRating(hotel.id)
  const strikethrough = originalPrice(hotel)

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
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          {/* Reads the structured discount — the old card stripped digits out of
              a label string, so a "$50 off" promo rendered as "Save 50%". */}
          {hotel.discount ? (
            <Badge className="bg-emerald-600 text-white">
              {formatDiscount(hotel.discount)}
            </Badge>
          ) : null}
          <Badge variant="secondary">{hotel.type}</Badge>
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {rating.reviewCount > 0 ? (
            <span className="bg-background/85 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium backdrop-blur">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              {rating.rating}
            </span>
          ) : null}
          <FavoriteButton
            hotelId={hotel.id}
            hotelName={hotel.name}
            className="bg-background/80 hover:bg-background size-8"
          />
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="font-heading text-lg leading-tight font-semibold">{hotel.name}</h3>
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <MapPin className="size-3.5" />
              {hotel.city}, {hotel.country}
            </p>
          </div>
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
              className="bg-muted text-muted-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
            >
              <span aria-hidden>{amenityIcons[a] ?? "✨"}</span>
              {a}
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-1 sm:flex-row sm:items-end sm:justify-between">
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
