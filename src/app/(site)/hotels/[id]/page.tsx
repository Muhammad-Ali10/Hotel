import Link from "next/link"
import { MapPin } from "lucide-react"

import { getHotel } from "@/data"
import { formatNumber } from "@/lib/format"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Badge } from "@/components/ui/badge"
import { StarRating } from "@/components/marketplace/star-rating"
import { BookingWidget } from "./_components/booking-widget"
import { HotelGallery } from "./_components/hotel-gallery"
import { HotelTabs } from "./_components/hotel-tabs"

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

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const hotel = getHotel(id)

  const visibleAmenities = hotel.amenities.slice(0, 4)
  const moreCount = hotel.amenities.length - visibleAmenities.length

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

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* LEFT */}
        <div className="min-w-0">

          {/* GALLERY */}
          <HotelGallery seed={hotel.seed} name={hotel.name} />

          {/* TITLE */}
          <div className="space-y-3 mt-6">
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

          {/* TABS + CONTENT */}
          <div className="mt-8">
            <HotelTabs hotel={hotel} />
          </div>
        </div>

        {/* RIGHT */}
        <div className="min-w-0">
          <BookingWidget hotelName={hotel.name} pricePerNight={hotel.pricePerNight} />
        </div>
      </div>
    </div>
  )
}
