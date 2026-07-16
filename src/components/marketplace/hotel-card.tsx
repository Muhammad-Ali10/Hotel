"use client"

import Link from "next/link"
import Image from "next/image"
import { MapPin } from "lucide-react"

import type { Hotel } from "@/types"
import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatNumber } from "@/lib/format"
import { originalPrice } from "@/lib/domain"
import { useHotelRating } from "@/store/selectors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StarRating } from "@/components/marketplace/star-rating"
import { FavoriteButton } from "@/components/marketplace/favorite-button"
import { DiscountBadge } from "@/components/marketplace/discount-badge"

export function HotelCard({ hotel }: { hotel: Hotel }) {
  const rating = useHotelRating(hotel.id)
  const strikethrough = originalPrice(hotel)

  return (
    <Card className="group overflow-hidden pt-0">
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <Image
          src={placeholderImage(hotel.seed, 560, 350)}
          alt={hotel.name}
          fill
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
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

      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading font-semibold">{hotel.name}</h3>
        </div>
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <MapPin className="size-3.5" />
          {hotel.city}, {hotel.country}
        </p>
        <div className="flex items-center gap-2 text-sm">
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
        <div className="flex items-end justify-between pt-1">
          <div>
            {strikethrough ? (
              <span className="text-muted-foreground mr-1 text-sm line-through">
                {formatCurrency(strikethrough)}
              </span>
            ) : null}
            <span className="font-heading text-lg font-semibold">
              {formatCurrency(hotel.pricePerNight)}
            </span>
            <span className="text-muted-foreground text-sm"> / night</span>
          </div>
          <Button size="sm" render={<Link href={`/hotels/${hotel.id}`}>Book Now</Link>} />
        </div>
      </CardContent>
    </Card>
  )
}
