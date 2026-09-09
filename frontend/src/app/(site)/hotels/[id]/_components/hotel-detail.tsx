"use client"

import * as React from "react"
import Link from "next/link"
import {
  Baby,
  Ban,
  BedDouble,
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
import { useProperty, useSearch } from "@/lib/api/hooks"
import { toHotel } from "@/lib/api/adapt"
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
import { PropertyCard } from "@/components/marketplace/property-card"
import { DiscountBadge } from "@/components/marketplace/discount-badge"
import { AmenityIcon } from "@/components/marketplace/amenity-icon"
import { NotFoundCard } from "@/components/shared/not-found-card"
import { HotelGallery } from "./hotel-gallery"
import { HotelReviews } from "./hotel-reviews"
import { ReserveCard } from "./reserve-card"
import { MobileReserveBar } from "./mobile-reserve-bar"

/**
 * One hotel, from the API.
 *
 * `id` in the route is really the SLUG — the guest-facing handle. The UUID is
 * deliberately not URL material, so a link is never a permission boundary.
 */
export function HotelDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useProperty(id)
  const [roomId, setRoomId] = React.useState<string | undefined>(undefined)

  const hotel = React.useMemo(() => (data ? toHotel(data) : null), [data])

  /*
   * Loading is its own state, not "not found".
   *
   * The dummy build read from a store that was always populated, so there was
   * no in-between. Over a network there is, and rendering "Hotel not found"
   * for the second before the response lands is a page that lies on every
   * single load.
   */
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading hotel">
          <div className="h-8 w-1/3 rounded bg-muted" />
          <div className="h-64 w-full rounded-xl bg-muted" />
          <div className="h-4 w-2/3 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted" />
        </div>
      </div>
    )
  }

  // A 404 is "no such hotel"; anything else is the API being unreachable, and
  // telling a guest their hotel is gone because the network blipped is worse
  // than telling them to try again.
  if (error && !error.isNotFound) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <NotFoundCard
          title="Could not load this hotel"
          description={error.message}
          href="/hotels"
          cta="Browse hotels"
        />
      </div>
    )
  }

  // Narrowed on `data`, not on `hotel`: TypeScript cannot see through the memo,
  // and checking the source keeps a non-null assertion out of every use below.
  if (!data || !hotel) {
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

  const rating = data.rating
  const selectedRoomId = roomId ?? hotel.rooms[0]?.id
  const selectedRoom = hotel.rooms.find((r) => r.id === selectedRoomId)
  const visibleAmenities = hotel.amenities.slice(0, 5)
  const moreCount = hotel.amenities.length - visibleAmenities.length

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
    // pb-28 keeps the last section clear of the mobile reserve bar
    <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-8">
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
        {/*
          `data.id`, not `hotel.id`. `toHotel()` deliberately sets `id` to the
          SLUG, because every `/hotels/[id]` link in the UI is a slug — but the
          favourites list is keyed on the property row, so the heart on this
          page was sending "hotel-chelsea" where a UUID was expected and getting
          a 400 back. The card grid already passes the row id; this did not.
        */}
        <HotelGallery propertyId={data.id} name={hotel.name} photos={hotel.photos} />
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
              {/* Labelled for what it actually does — the target is the address
                  block, not a map. The real map is the "Open in Maps" link. */}
              <Link href="#location" className="text-primary hover:underline">
                View location
              </Link>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleAmenities.map((a) => (
              <Badge key={a} variant="outline" className="gap-1.5">
                <AmenityIcon amenity={a} className="size-3" />
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
                  <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
                    <AmenityIcon amenity={a} className="size-3.5" />
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
          <HotelReviews slug={id} hotelName={hotel.name} />

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
          <ReserveCard detail={data} selectedRoomId={selectedRoomId} onSelectRoom={setRoomId} />
        </div>
      </div>

      {/* SIMILAR PROPERTIES */}
      <section className="mt-14">
        <Separator className="mb-8" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-2xl font-semibold">Similar Properties</h2>
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0"
            render={<Link href={`/hotels?city=${encodeURIComponent(hotel.city)}`}>View All ›</Link>}
          />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <SimilarProperties city={hotel.city} exceptSlug={id} />
        </div>
      </section>

      <MobileReserveBar room={selectedRoom} />
    </div>
  )
}

/**
 * Other places in the same city.
 *
 * Its own search call rather than a slice of a catalogue held in memory —
 * which is what this used to be, and what stopped working the moment the
 * catalogue became something the server owns. Three cards is not worth
 * fetching every property to fill.
 *
 * Ordered `recommended`, which is the ranking (rule #104) — so the strip shows
 * what search would show, not an arbitrary three.
 */
function SimilarProperties({
  city,
  exceptSlug,
}: {
  city: string
  exceptSlug: string
}) {
  const { data, isPending } = useSearch({ city, sort: "recommended", limit: 4 })

  const others = (data?.items ?? []).filter((item) => item.slug !== exceptSlug).slice(0, 3)

  if (isPending) {
    return (
      <>
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-72 animate-pulse rounded-xl" />
        ))}
      </>
    )
  }

  if (others.length === 0) {
    return (
      <p className="text-muted-foreground col-span-full text-sm">
        Nothing else listed in {city} yet.
      </p>
    )
  }

  return (
    <>
      {others.map((item) => (
        <PropertyCard key={item.id} item={item} />
      ))}
    </>
  )
}
