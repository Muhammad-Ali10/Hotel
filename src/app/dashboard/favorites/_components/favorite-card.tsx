"use client"

import Link from "next/link"
import Image from "next/image"
import { Heart, MapPin } from "lucide-react"
import { toast } from "sonner"

import type { Hotel } from "@/types"
import { placeholderImage } from "@/lib/images"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export function FavoriteCard({ hotel }: { hotel: Hotel }) {
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
        <Button
          size="icon"
          variant="secondary"
          aria-label="Remove from saved"
          onClick={() => toast.success("Removed from saved")}
          className="absolute top-3 right-3 rounded-full shadow-sm"
        >
          <Heart className="size-4 fill-current" />
        </Button>
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
