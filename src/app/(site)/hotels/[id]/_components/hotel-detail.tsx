"use client"

import * as React from "react"
import Link from "next/link"
import {
  Baby,
  Ban,
  BedDouble,
  Check,
  Cigarette,
  Clock,
  CreditCard,
  MapPin,
  PawPrint,
  Ruler,
  Users,
} from "lucide-react"

import { formatCurrency, formatNumber } from "@/lib/format"
import { formatTime24 } from "@/lib/domain"
import { useHotel, useHotelRating, useHotels } from "@/store/selectors"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { StarRating } from "@/components/marketplace/star-rating"
import { HotelCard } from "@/components/marketplace/hotel-card"
import { DiscountBadge } from "@/components/marketplace/discount-badge"
import { NotFoundCard } from "@/components/shared/not-found-card"
import { HotelGallery } from "./hotel-gallery"
import { HotelReviews } from "./hotel-reviews"
import { ReserveCard } from "./reserve-card"

const amenityChips: Record<string, string> = {
  Breakfast: "🍳",
  Pool: "🏊",
  Spa: "💆",
  Parking: "🅿",
  WiFi: "📶",
  Gym: "🏋",
  Restaurant: "🍽",
  Bar: "🍸",
  Beach: "🏖",
}

export function HotelDetail({ id }: { id: string }) {
  const hotel = useHotel(id)
  const hotels = useHotels()
  const rating = useHotelRating(id)
  const [roomId, setRoomId] = React.useState<string | undefined>(undefined)

  if (!hotel) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <NotFoundCard
          title="Hotel not found"
          description="This property is no longer listed."
          href="/hotels"
          cta="Browse hotels"
        />
      </div>
    )
  }

  const selectedRoomId = roomId ?? hotel.rooms[0]?.id
  const visibleAmenities = hotel.amenities.slice(0, 5)
  const moreCount = hotel.amenities.length - visibleAmenities.length
  const similar = hotels.filter((h) => h.id !== hotel.id && h.city !== hotel.city).slice(0, 3)

  // Every rule below is whatever the partner set in the extranet — the page used
  // to hardcode its own values, which is how "pets not allowed" ended up
  // contradicting the property's own pets-at-$35 policy.
  const houseRules = [
    { icon: Clock, label: "Check-in", value: `From ${formatTime24(hotel.policies.checkInTime)}` },
    { icon: Clock, label: "Check-out", value: `Until ${formatTime24(hotel.policies.checkOutTime)}` },
    { icon: Ban, label: "Cancellation", value: hotel.policies.cancellation },
    { icon: CreditCard, label: "Payment", value: hotel.policies.payment },
    { icon: PawPrint, label: "Pets", value: hotel.policies.pets },
    { icon: Cigarette, label: "Smoking", value: hotel.policies.smoking },
    { icon: Baby, label: "Children", value: hotel.policies.children },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      {/* BREADCRUMB */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/">Home</Link>} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/hotels">Hotels</Link>} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              render={
                <Link href={`/hotels?city=${encodeURIComponent(hotel.city)}`}>{hotel.city}</Link>
              }
            />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{hotel.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* GALLERY */}
      <div className="mt-4">
        <HotelGallery hotelId={hotel.id} name={hotel.name} photos={hotel.photos} />
      </div>

      {/* TITLE */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{hotel.type}</Badge>
            {hotel.discount ? <DiscountBadge discount={hotel.discount} /> : null}
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {hotel.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {rating.reviewCount > 0 ? (
              <span className="flex items-center gap-1.5">
                <StarRating rating={rating.rating} size="size-4" />
                <span className="font-medium">{rating.rating}</span>
                <Link href="#reviews" className="text-muted-foreground hover:underline">
                  ({formatNumber(rating.reviewCount)}{" "}
                  {rating.reviewCount === 1 ? "review" : "reviews"})
                </Link>
              </span>
            ) : (
              <span className="text-muted-foreground">No reviews yet</span>
            )}
            <span className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="size-4" />
              {hotel.city}, {hotel.country}
              <Link href="#location" className="text-primary hover:underline">
                View on Map
              </Link>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleAmenities.map((a) => (
              <Badge key={a} variant="outline" className="gap-1">
                <span aria-hidden>{amenityChips[a] ?? "✨"}</span>
                {a}
              </Badge>
            ))}
            {moreCount > 0 ? <Badge variant="secondary">+{moreCount} more</Badge> : null}
          </div>
        </div>

        <div className="text-right">
          <p className="text-muted-foreground text-sm">From</p>
          <p>
            <span className="font-heading text-2xl font-semibold">
              {formatCurrency(hotel.pricePerNight)}
            </span>
            <span className="text-muted-foreground text-sm"> / night</span>
          </p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* LEFT */}
        <div className="min-w-0 space-y-10">
          {/* ABOUT */}
          <section>
            <h2 className="font-heading text-xl font-semibold">About This Property</h2>
            <p className="text-muted-foreground mt-3 text-pretty">{hotel.description}</p>
          </section>

          {/* CHOOSE YOUR ROOM */}
          <section id="rooms" className="scroll-mt-24">
            <h2 className="font-heading text-xl font-semibold">Choose Your Room</h2>
            <div className="mt-4 grid grid-cols-1 gap-4">
              {hotel.rooms.map((room) => (
                <Card
                  key={room.id}
                  className={
                    room.id === selectedRoomId ? "ring-primary/40 ring-2" : undefined
                  }
                >
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="font-heading font-semibold">{room.name}</h3>
                      <p className="text-muted-foreground text-sm">{room.description}</p>
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
                          {room.size} m²
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
                        variant={room.id === selectedRoomId ? "default" : "outline"}
                        onClick={() => {
                          setRoomId(room.id)
                          document
                            .getElementById("reserve")
                            ?.scrollIntoView({ behavior: "smooth", block: "center" })
                        }}
                      >
                        {room.id === selectedRoomId ? "Selected" : "Select"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* AMENITIES */}
          <section>
            <h2 className="font-heading text-xl font-semibold">Amenities &amp; Facilities</h2>
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

          {/* HOUSE RULES */}
          <section>
            <h2 className="font-heading text-xl font-semibold">House Rules</h2>
            <Card className="mt-4">
              <CardContent className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
                {houseRules.map((rule) => (
                  <div key={rule.label} className="flex items-start gap-3">
                    <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
                      <rule.icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{rule.label}</p>
                      <p className="text-muted-foreground text-sm">{rule.value}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          {/* REVIEWS */}
          <HotelReviews hotelId={hotel.id} hotelName={hotel.name} />

          {/* LOCATION */}
          <section id="location" className="scroll-mt-24">
            <h2 className="font-heading text-xl font-semibold">Location</h2>
            <Card className="mt-4">
              <CardContent>
                <div className="bg-muted/40 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
                  <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-full">
                    <MapPin className="size-5" />
                  </span>
                  <div>
                    <p className="font-heading font-semibold">{hotel.name}</p>
                    {/* The address the partner entered — this line used to read
                        "50 Central Park South" for all ten hotels. */}
                    <p className="text-muted-foreground text-sm">{hotel.address}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${hotel.name} ${hotel.address}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in Maps
                      </a>
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* RIGHT */}
        <div className="min-w-0">
          <ReserveCard hotel={hotel} selectedRoomId={selectedRoomId} onSelectRoom={setRoomId} />
        </div>
      </div>

      {/* SIMILAR PROPERTIES */}
      {similar.length > 0 ? (
        <section className="mt-14">
          <Separator className="mb-8" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-heading text-2xl font-semibold">Similar Properties</h2>
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0"
              render={<Link href="/hotels">View All ›</Link>}
            />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((h) => (
              <HotelCard key={h.id} hotel={h} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
