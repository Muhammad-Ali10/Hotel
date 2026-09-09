"use client"

import Link from "next/link"
import Image from "next/image"
import { MapPin } from "lucide-react"
import type { FavoriteItem } from "@stayora/shared"

import { placeholderImage } from "@/lib/images"
import { formatCurrency, formatNumber } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { StarRating } from "@/components/marketplace/star-rating"
import { FavoriteButton } from "@/components/marketplace/favorite-button"

export function FavoriteCard({ item }: { item: FavoriteItem }) {
  return (
    <Card className="group overflow-hidden pt-0">
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <Image
          src={placeholderImage(item.seed, 600, 400)}
          alt={item.name}
          fill
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <FavoriteButton
          propertyId={item.id}
          propertyName={item.name}
          className="bg-background/80 hover:bg-background absolute top-3 right-3"
        />
      </div>

      <CardContent className="space-y-2">
        <h3 className="font-heading font-semibold">
          {/*
            A suspended property keeps its card but loses its link (rule #96).
            Sending a guest to a page that will not sell them anything is worse
            than a card that says so.
          */}
          {item.available ? (
            <Link href={`/hotels/${item.slug}`} className="hover:underline">
              {item.name}
            </Link>
          ) : (
            <span>{item.name}</span>
          )}
        </h3>

        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <MapPin className="size-3.5" />
          {item.city}, {item.country}
        </p>

        {item.rating.reviewCount > 0 ? (
          <p className="flex items-center gap-1.5 text-sm">
            <StarRating rating={item.rating.rating} size="size-3.5" />
            <span className="font-medium">{item.rating.rating}</span>
            <span className="text-muted-foreground">
              ({formatNumber(item.rating.reviewCount)})
            </span>
          </p>
        ) : null}

        {item.available ? (
          <p className="text-sm">
            <span className="text-muted-foreground">from </span>
            <span className="font-heading text-lg font-semibold">
              {formatCurrency(item.fromPrice)}
            </span>
            <span className="text-muted-foreground"> per night</span>
          </p>
        ) : (
          <Badge variant="secondary">No longer bookable</Badge>
        )}
      </CardContent>
    </Card>
  )
}
