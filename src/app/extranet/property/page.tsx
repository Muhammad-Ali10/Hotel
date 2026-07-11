import Image from "next/image"
import Link from "next/link"
import { ChevronLeft, MapPin, Star } from "lucide-react"

import { hotelImage } from "@/lib/images"
import {
  PageHeader,
  SectionCard,
  StatusPill,
  Icon,
} from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { EditDetailsDialog } from "./_components/edit-details-dialog"

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

const details = [
  { label: "Total Rooms", value: "142" },
  { label: "Floors", value: "8" },
  { label: "Year Built", value: "2018" },
  { label: "Last Renovated", value: "2024" },
  { label: "Check-in", value: "15:00" },
  { label: "Check-out", value: "12:00" },
  { label: "Timezone", value: "America/Los_Angeles (PST, UTC-8)" },
  { label: "Parking", value: "Valet & self-parking" },
]

const contact = [
  { icon: "Phone", label: "Phone", value: "+1 (310) 555-0101" },
  { icon: "Mail", label: "Email", value: "reservations@grandhorizon.com" },
  { icon: "Globe", label: "Website", value: "www.grandhorizon.com" },
  { icon: "Phone", label: "Emergency", value: "+1 (310) 555-0199" },
]

const languages = ["English", "Spanish", "French", "Japanese", "Arabic"]

export default function PropertyInfoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Property Info"
        subtitle="Overview and details for Grand Horizon"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/properties" />}
        >
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
                  <p className="text-muted-foreground truncate text-xs">
                    {s.desc}
                  </p>
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
            src={hotelImage("grand-horizon", 1280, 480)}
            alt="Grand Horizon"
            fill
            sizes="(max-width: 1400px) 100vw, 1400px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 text-white">
            <div className="mb-1 flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <h2 className="font-heading flex items-center gap-2 text-2xl font-semibold">
              Grand Horizon
              <StatusPill status="Active" />
            </h2>
            <p className="mt-1 flex items-center gap-1 text-sm text-white/90">
              <MapPin className="size-3.5" />
              28420 Pacific Coast Highway, Malibu, CA 90265, United States
            </p>
          </div>
        </div>
        <CardContent className="space-y-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
              Grand Horizon is a premier luxury beachfront resort perched on the
              iconic Malibu coastline. With 142 meticulously designed rooms and
              suites, the property offers an unparalleled blend of modern
              sophistication and coastal serenity. Guests enjoy panoramic
              Pacific Ocean views, a world-class spa, three signature
              restaurants, and direct beach access. The resort&#39;s architecture
              seamlessly integrates indoor and outdoor living, with
              floor-to-ceiling windows and expansive terraces in every room.
            </p>
            <EditDetailsDialog />
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
            <p className="text-muted-foreground mb-3 text-sm">
              28420 Pacific Coast Highway, Malibu, CA 90265, United States
            </p>
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
                  href="https://www.google.com/maps/search/?api=1&query=Grand+Horizon+Malibu"
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
