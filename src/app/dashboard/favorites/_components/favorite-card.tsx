"use client"

import Link from "next/link"
import Image from "next/image"
import { MapPin } from "lucide-react"

import type { Hotel } from "@/types"
import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatNumber } from "@/lib/format"
import { useHotelRating } from "@/store/selectors"
import { Card, CardContent } from "@/components/ui/card"
import { StarRating } from "@/components/marketplace/star-rating"
import { FavoriteButton } from "@/components/marketplace/favorite-button"

export function FavoriteCard({ hotel }: { hotel: Hotel }) {
  const rating = useHotelRating(hotel.id)

  return (
    <Card className="group overflow-hidden pt-0">
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <Image
          src={placeholderImage(hotel.seed, 600, 400)}
          alt={hotel.name}
          fill
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Un-saving here removes the card — the heart used to only toast. */}
        <FavoriteButton
          hotelId={hotel.id}
          hotelName={hotel.name}
          className="bg-background/80 hover:bg-background absolute top-3 right-3"
        />
      </div>

      <CardContent className="space-y-2">
        <h3 className="font-heading font-semibold">
          <Link href={`/hotels/${hotel.id}`} className="hover:underline">
            {hotel.name}
          </Link>
        </h3>
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <MapPin className="size-3.5" />
          {hotel.city}, {hotel.country}
        </p>
        {rating.reviewCount > 0 ? (
          <p className="flex items-center gap-1.5 text-sm">
            <StarRating rating={rating.rating} size="size-3.5" />
            <span className="font-medium">{rating.rating}</span>
            <span className="text-muted-foreground">
              ({formatNumber(rating.reviewCount)})
            </span>
          </p>
        ) : null}
        <p className="text-sm">
          <span className="font-heading text-lg font-semibold">
            {formatCurrency(hotel.pricePerNight)}
          </span>
          <span className="text-muted-foreground"> per night</span>
        </p>
      </CardContent>
    </Card>
  )
}
