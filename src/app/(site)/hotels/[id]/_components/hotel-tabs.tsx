"use client"

import Link from "next/link"
import {
  ArrowUpRight,
  BedDouble,
  Check,
  MapPin,
  Ruler,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import type { Hotel } from "@/types"
import { formatCurrency, formatNumber } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StarRating } from "@/components/marketplace/star-rating"

export function HotelTabs({ hotel }: { hotel: Hotel }) {
  const address = `50 Central Park South, ${hotel.city}, ${hotel.country}`

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList
        variant="line"
        className="h-auto w-full max-w-full flex-nowrap justify-start gap-1"
      >
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="rooms">Rooms &amp; Prices</TabsTrigger>
        <TabsTrigger value="amenities">Amenities</TabsTrigger>
        <TabsTrigger value="reviews">
          Reviews ({formatNumber(hotel.reviewCount)})
        </TabsTrigger>
        <TabsTrigger value="location">Location</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="pt-6">
        <div className="space-y-10">
          <AboutSection hotel={hotel} />
          <AmenitiesSection hotel={hotel} />
        </div>
      </TabsContent>

      <TabsContent value="rooms" className="pt-6">
        <RoomsSection hotel={hotel} />
      </TabsContent>

      <TabsContent value="amenities" className="pt-6">
        <AmenitiesSection hotel={hotel} />
      </TabsContent>

      <TabsContent value="reviews" className="pt-6">
        <ReviewsSection hotel={hotel} />
      </TabsContent>

      <TabsContent value="location" className="pt-6">
        <LocationSection hotel={hotel} address={address} />
      </TabsContent>
    </Tabs>
  )
}

function AboutSection({ hotel }: { hotel: Hotel }) {
  return (
    <section>
      <h2 className="font-heading text-xl font-semibold">About This Property</h2>
      <p className="text-muted-foreground mt-3 text-pretty">{hotel.description}</p>
      <Button
        variant="link"
        size="sm"
        className="mt-1 h-auto px-0"
        render={<Link href="#">Read More</Link>}
      />
    </section>
  )
}

function AmenitiesSection({ hotel }: { hotel: Hotel }) {
  return (
    <section>
      <h2 className="font-heading text-xl font-semibold">Amenities</h2>
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {hotel.amenities.map((a) => (
          <div key={a} className="flex items-center gap-2 text-sm">
            <span className="bg-primary/10 text-primary flex size-5 shrink-0 items-center justify-center rounded-full">
              <Check className="size-3" />
            </span>
            {a}
          </div>
        ))}
      </div>
    </section>
  )
}

function RoomsSection({ hotel }: { hotel: Hotel }) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold">Rooms &amp; Prices</h2>
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          render={<Link href="#rooms">View All Rooms ›</Link>}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4">
        {hotel.rooms.map((room) => (
          <Card key={room.id}>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="font-heading font-semibold">{room.name}</h3>
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="flex items-center gap-1">
                    <Users className="size-3.5" />
                    {room.guests} Guests
                  </span>
                  <span className="flex items-center gap-1">
                    <BedDouble className="size-3.5" />
                    {room.bed}
                  </span>
                  <span className="flex items-center gap-1">
                    <Ruler className="size-3.5" />
                    {room.size}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {room.features.map((f) => (
                    <Badge key={f} variant="outline">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                <p>
                  <span className="font-heading text-xl font-semibold">
                    {formatCurrency(room.pricePerNight)}
                  </span>
                  <span className="text-muted-foreground text-sm"> / night</span>
                </p>
                <Button
                  size="sm"
                  onClick={() => toast.success(`${room.name} selected`)}
                >
                  Select Room
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function ReviewsSection({ hotel }: { hotel: Hotel }) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-xl font-semibold">Guest Reviews</h2>
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          render={<Link href="#reviews">See All Reviews ›</Link>}
        />
      </div>

      <div className="mt-4 space-y-4">
        {hotel.reviews.map((review) => (
          <Card key={review.id}>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-heading font-semibold">
                    {review.author}
                  </span>
                  <Badge variant="secondary" className="gap-1">
                    <Check className="size-3" />
                    Verified Guest
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5">
                  <StarRating rating={review.rating} size="size-3.5" />
                  <span className="text-sm font-medium">{review.rating}</span>
                </div>
              </div>
              <p className="text-muted-foreground text-sm text-pretty">
                {review.comment}
              </p>
              <p className="text-muted-foreground text-xs">{review.date}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

function LocationSection({
  hotel,
  address,
}: {
  hotel: Hotel
  address: string
}) {
  return (
    <section>
      <h2 className="font-heading text-xl font-semibold">Location</h2>
      <Card className="mt-4">
        <CardContent>
          <div className="bg-muted/40 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
            <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-full">
              <MapPin className="size-5" />
            </span>
            <div>
              <p className="font-heading font-semibold">{hotel.name}</p>
              <p className="text-muted-foreground text-sm">{address}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              render={
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${hotel.name} ${hotel.city}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Maps
                  <ArrowUpRight className="size-4" />
                </a>
              }
            />
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
