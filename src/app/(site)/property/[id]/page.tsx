import Link from "next/link"
import {
  Ban,
  BedDouble,
  Check,
  Cigarette,
  Clock,
  CreditCard,
  Flame,
  MapPin,
  PawPrint,
  Ruler,
  Users,
} from "lucide-react"

import { getHotel, hotels } from "@/data"
import { formatCurrency, formatNumber } from "@/lib/format"
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
import { PropertyGallery } from "./_components/property-gallery"
import { ReserveCard } from "./_components/reserve-card"

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

const houseRules = [
  { icon: Clock, label: "Check-in", value: "From 3:00 PM" },
  { icon: Clock, label: "Check-out", value: "Until 12:00 PM" },
  { icon: Ban, label: "Cancellation", value: "Free until 24h before" },
  { icon: CreditCard, label: "Payment", value: "Card or pay at property" },
  { icon: PawPrint, label: "Pets", value: "Not allowed" },
  { icon: Cigarette, label: "Smoking", value: "Designated areas only" },
]

const ratingCategories = [
  { label: "Cleanliness", value: 4.9 },
  { label: "Comfort", value: 4.8 },
  { label: "Location", value: 4.9 },
  { label: "Facilities", value: 4.7 },
  { label: "Staff", value: 5.0 },
]

function ratingLabel(rating: number) {
  if (rating >= 4.8) return "Exceptional"
  if (rating >= 4.5) return "Excellent"
  if (rating >= 4) return "Very Good"
  return "Good"
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const hotel = getHotel(id)

  const visibleAmenities = hotel.amenities.slice(0, 5)
  const moreCount = hotel.amenities.length - visibleAmenities.length
  const similar = hotels.filter((h) => h.id !== hotel.id).slice(0, 3)

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
                <Link href={`/hotels?city=${encodeURIComponent(hotel.city)}`}>
                  {hotel.city}
                </Link>
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
        <PropertyGallery seed={hotel.seed} name={hotel.name} />
      </div>

      {/* TITLE */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{hotel.type}</Badge>
            {hotel.discountLabel ? <Badge>{hotel.discountLabel}</Badge> : null}
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {hotel.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5">
              <StarRating rating={hotel.rating} size="size-4" />
              <span className="font-medium">{hotel.rating}</span>
              <span className="text-muted-foreground">
                ({formatNumber(hotel.reviewCount)} Reviews)
              </span>
            </span>
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
            {moreCount > 0 ? (
              <Badge variant="secondary">+{moreCount} more</Badge>
            ) : null}
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

      {/* URGENCY BANNER */}
      <div className="mt-5 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200">
        <Flame className="size-4 shrink-0" />
        <span>
          <span className="font-semibold">In high demand</span> — booked 18 times
          in the last 24 hours. Only a few rooms left at this price.
        </span>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* LEFT */}
        <div className="min-w-0 space-y-10">
          {/* ABOUT */}
          <section>
            <h2 className="font-heading text-xl font-semibold">
              About This Property
            </h2>
            <p className="text-muted-foreground mt-3 text-pretty">
              {hotel.description}
            </p>
          </section>

          {/* CHOOSE YOUR ROOM */}
          <section id="rooms">
            <h2 className="font-heading text-xl font-semibold">Choose Your Room</h2>
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
                        <span className="text-muted-foreground text-sm">
                          {" "}
                          / night
                        </span>
                      </p>
                      <Button
                        size="sm"
                        render={<a href="#reserve">Reserve</a>}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* AMENITIES */}
          <section>
            <h2 className="font-heading text-xl font-semibold">
              Amenities &amp; Facilities
            </h2>
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
                  <div key={rule.label} className="flex items-center gap-3">
                    <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
                      <rule.icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{rule.label}</p>
                      <p className="text-muted-foreground text-sm">
                        {rule.value}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          {/* REVIEWS */}
          <section id="reviews">
            <h2 className="font-heading text-xl font-semibold">Guest Reviews</h2>

            <Card className="mt-4">
              <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="flex flex-col items-center justify-center gap-1 sm:pr-6">
                  <span className="font-heading text-4xl font-semibold">
                    {hotel.rating}
                  </span>
                  <StarRating rating={hotel.rating} size="size-4" />
                  <span className="text-sm font-medium">
                    {ratingLabel(hotel.rating)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatNumber(hotel.reviewCount)} reviews
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  {ratingCategories.map((c) => (
                    <div key={c.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{c.label}</span>
                        <span className="font-medium">{c.value.toFixed(1)}</span>
                      </div>
                      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${(c.value / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

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
                          {review.badge}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <StarRating rating={review.rating} size="size-3.5" />
                        <span className="text-sm font-medium">
                          {review.rating}
                        </span>
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

          {/* LOCATION */}
          <section id="location">
            <h2 className="font-heading text-xl font-semibold">Location</h2>
            <Card className="mt-4">
              <CardContent>
                <div className="bg-muted/40 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center">
                  <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-full">
                    <MapPin className="size-5" />
                  </span>
                  <div>
                    <p className="font-heading font-semibold">{hotel.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {hotel.city}, {hotel.country}
                    </p>
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
          <ReserveCard hotel={hotel} />
        </div>
      </div>

      {/* SIMILAR PROPERTIES */}
      <section className="mt-14">
        <Separator className="mb-8" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-2xl font-semibold">
            Similar Properties
          </h2>
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
    </div>
  )
}
