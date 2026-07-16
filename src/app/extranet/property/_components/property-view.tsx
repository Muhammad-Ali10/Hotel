"use client"

import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, ExternalLink, MapPin } from "lucide-react"

import { hotelImage } from "@/lib/images"
import { formatTime24 } from "@/lib/domain"
import { useActiveHotel, useHotelRating } from "@/store/selectors"
import { PageHeader, SectionCard, Icon } from "@/components/extranet/shared"
import { StarRating } from "@/components/marketplace/star-rating"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { NotFoundCard } from "@/components/shared/not-found-card"
import { EditDetailsDialog } from "./edit-details-dialog"

const sections = [
  {
    title: "Room Types",
    desc: "Manage rooms, pricing, and inventory",
    icon: "BedDouble",
    href: "/extranet/property/room-types",
  },
  {
    title: "Amenities",
    desc: "Hotel facilities and services",
    icon: "Sparkles",
    href: "/extranet/property/amenities",
  },
  {
    title: "Photos",
    desc: "Photo gallery and media assets",
    icon: "Camera",
    href: "/extranet/property/photos",
  },
  {
    title: "Policies",
    desc: "Cancellation, house rules, check-in times",
    icon: "FileText",
    href: "/extranet/property/policies",
  },
]

const languages = ["English", "Spanish", "French", "Japanese", "Arabic"]

/**
 * The partner's view of a property they manage. Everything here is the same
 * record the public listing renders — the page used to be hardcoded around a
 * "Grand Horizon" that existed on no public page at all.
 */
export function PropertyView() {
  const hotel = useActiveHotel()
  const rating = useHotelRating(hotel?.id ?? "")

  if (!hotel) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property from your portfolio to manage it."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const totalRooms = hotel.rooms.reduce((sum, r) => sum + r.units, 0)
  const details = [
    { label: "Total Rooms", value: String(totalRooms) },
    { label: "Room Types", value: String(hotel.rooms.length) },
    { label: "Property Type", value: hotel.type },
    { label: "From", value: `$${hotel.pricePerNight} / night` },
    { label: "Check-in", value: formatTime24(hotel.policies.checkInTime) },
    { label: "Check-out", value: formatTime24(hotel.policies.checkOutTime) },
    { label: "Guest Rating", value: rating.reviewCount ? `${rating.rating} / 5` : "No reviews" },
    { label: "Reviews", value: String(rating.reviewCount) },
  ]

  const contact = [
    { icon: "Phone", label: "Phone", value: "+1 (310) 555-0101" },
    {
      icon: "Mail",
      label: "Email",
      value: `reservations@${hotel.seed.replace(/-/g, "")}.com`,
    },
    { icon: "Globe", label: "Website", value: `www.${hotel.seed.replace(/-/g, "")}.com` },
    { icon: "Phone", label: "Emergency", value: "+1 (310) 555-0199" },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Property Info" subtitle={`Overview and details for ${hotel.name}`}>
        {/* The partner can see exactly what a guest sees */}
        <Button
          variant="outline"
          size="sm"
          render={
            <Link href={`/hotels/${hotel.id}`} target="_blank">
              <ExternalLink className="size-4" />
              View public listing
            </Link>
          }
        />
        <Button variant="outline" size="sm" render={<Link href="/extranet/properties" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((s) => (
          <Link key={s.title} href={s.href}>
            <Card size="sm" className="hover:bg-muted/40 h-full transition-colors">
              <CardContent className="flex items-center gap-3">
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon name={s.icon} className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{s.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Hero */}
      <Card className="overflow-hidden py-0">
        <div className="relative aspect-[21/8] w-full">
          <Image
            src={hotelImage(hotel.seed, 1280, 480)}
            alt={hotel.name}
            fill
            sizes="(max-width: 1400px) 100vw, 1400px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 text-white">
            {rating.reviewCount > 0 ? (
              <div className="mb-1">
                <StarRating rating={rating.rating} size="size-4" />
              </div>
            ) : null}
            <h2 className="font-heading flex items-center gap-2 text-2xl font-semibold">
              {hotel.name}
              <Badge className="border-transparent bg-emerald-500/20 text-emerald-100">
                Active
              </Badge>
            </h2>
            <p className="mt-1 flex items-center gap-1 text-sm text-white/90">
              <MapPin className="size-3.5" />
              {hotel.address}
            </p>
          </div>
        </div>
        <CardContent className="space-y-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
              {hotel.description}
            </p>
            <EditDetailsDialog hotel={hotel} />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-5 sm:grid-cols-4">
            {details.map((d) => (
              <div key={d.label} className="space-y-0.5">
                <p className="text-muted-foreground text-xs">{d.label}</p>
                <p className="text-sm font-medium">{d.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Contact Information">
          <ul className="space-y-4">
            {contact.map((c) => (
              <li key={c.label} className="flex items-center gap-3">
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon name={c.icon} className="size-4" />
                </span>
                <div>
                  <p className="text-muted-foreground text-xs">{c.label}</p>
                  <p className="text-sm font-medium">{c.value}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard title="Location">
            <p className="text-muted-foreground mb-3 text-sm">{hotel.address}</p>
            <div className="bg-muted relative flex aspect-video items-center justify-center overflow-hidden rounded-lg">
              <MapPin className="text-muted-foreground size-8" />
              <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_60%,var(--color-muted))]" />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 w-full"
              render={
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${hotel.name} ${hotel.address}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
            >
              <MapPin className="size-4" />
              Open in Google Maps
            </Button>
          </SectionCard>

          <SectionCard title="Languages Spoken">
            <div className="flex flex-wrap gap-2">
              {languages.map((l) => (
                <Badge key={l} variant="secondary">
                  {l}
                </Badge>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
