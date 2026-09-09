"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ExternalLink, MapPin, MoreVertical, Plus, Users } from "lucide-react"

import type { Stat } from "@/lib/extranet/types"
import { usePartnerBookings, usePartnerProperties, usePerformance } from "@/lib/api/hooks"
import { toISODate } from "@/lib/domain"
import { hotelImage } from "@/lib/images"
import { formatCurrency } from "@/lib/format"
import { PageHeader, SectionCard, StatGrid } from "@/components/extranet/shared"
import { StarRating } from "@/components/marketplace/star-rating"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * The portfolio, counted live from the store.
 *
 * It used to read a module-level snapshot, so a guest review, a rename or a
 * room edit moved the numbers on every other screen but not this one. The star
 * row also built itself with `Array.from({length: rating})`, which truncates —
 * a 4.6 hotel showed 4 stars here and 5 on its own listing.
 */
/** Whole days, on an ISO date. No clock arithmetic near a window boundary. */
function addDaysISO(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function PropertiesView() {
  const { data: properties, isPending, error } = usePartnerProperties()
  const { data: bookings } = usePartnerBookings()

  const today = toISODate(new Date())

  /*
   * Trading figures from the SERVER (rule #62).
   *
   * Occupancy and ADR used to be worked out here from a fixture — so this
   * screen, the property page and the analytics screens each quoted a
   * different number for the same hotel. There is one definition now, and it
   * lives where `booking_nights` does.
   *
   * Two windows because they answer two questions: the cards show how the
   * property has been trading (thirty days), the tiles show today.
   */
  const month = usePerformance({ from: addDaysISO(today, -29), to: today })
  const now = usePerformance({ from: today, to: today })

  const perfById = new Map((month.data ?? []).map((row) => [row.propertyId, row]))
  const todayById = new Map((now.data ?? []).map((row) => [row.propertyId, row]))

  const rows = (properties ?? []).map((property) => {
    const perf = perfById.get(property.id)
    const todayPerf = todayById.get(property.id)
    return {
      ...property,
      occupancy: perf?.occupancy ?? 0,
      adr: perf?.adr ?? property.fromPrice,
      score: perf?.score ?? null,
      reviews: perf?.reviews ?? 0,
      revenueToday: todayPerf?.revenue ?? 0,
    }
  })

  const totalRooms = rows.reduce((sum, r) => sum + r.rooms, 0)
  const avgOccupancy = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.occupancy, 0) / rows.length)
    : 0

  /*
   * Arrivals today, counted from the bookings themselves.
   *
   * `performance` measures nights STAYED; "who is walking in this morning" is
   * a different question and the booking list is the only place that answers
   * it.
   */
  const todaysArrivals = (bookings ?? []).filter(
    (b) => b.checkIn === today && b.status !== "cancelled" && b.status !== "no_show"
  ).length

  const todaysRevenue = rows.reduce((sum, r) => sum + (r.revenueToday ?? 0), 0)

  const stats: Stat[] = [
    {
      label: "Total Properties",
      value: String(rows.length),
      caption: `${rows.filter((r) => r.status === "active").length} live`,
    },
    {
      label: "Total Rooms",
      value: String(totalRooms),
      caption: `${avgOccupancy}% occupancy, last 30 days`,
    },
    {
      label: "Arrivals Today",
      value: String(todaysArrivals),
      caption: "across all properties",
    },
    {
      label: "Today's Revenue",
      value: formatCurrency(todaysRevenue),
      caption: "group total",
    },
  ]

  if (isPending) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading portfolio">
        <div className="bg-muted h-24 animate-pulse rounded-xl" />
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-muted h-72 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle={`Portfolio Management · ${rows.length} properties`}
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/account" />}>
          <Users className="size-4" />
          Team Access
        </Button>
        <Button size="sm">
          <Plus className="size-4" />
          Add Property
        </Button>
      </PageHeader>

      <StatGrid stats={stats} className="sm:grid-cols-2 lg:grid-cols-4" />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => (
          <Card key={p.id} className="overflow-hidden py-0">
            <div className="relative aspect-[16/9] w-full">
              <Image
                src={hotelImage(p.slug, 640, 360)}
                alt={p.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="object-cover"
              />
              <span className="absolute top-3 left-3">
                {/*
                  The property's REAL status. It used to say "Active" on every
                  card, including drafts and listings the platform had
                  suspended.
                */}
                <Badge className="border-transparent bg-black/40 text-white capitalize backdrop-blur">
                  {p.status.replace("_", " ")}
                </Badge>
              </span>
            </div>
            <CardContent className="space-y-4 py-4">
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading text-base font-semibold">{p.name}</h3>
                  <div className="shrink-0 pt-1">
                    {p.reviews > 0 && p.score !== null ? (
                      <StarRating rating={p.score} size="size-3.5" />
                    ) : null}
                  </div>
                </div>
                <p className="text-muted-foreground flex items-center gap-1 text-sm">
                  <MapPin className="size-3.5" />
                  {p.city}, {p.country}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center">
                <Metric label="Rooms" value={String(p.rooms)} />
                <Metric label="Occupancy" value={`${p.occupancy}%`} />
                <Metric label="ADR" value={p.adr === null ? "—" : formatCurrency(p.adr)} />
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-heading font-semibold">
                    {p.revenueToday === null ? "—" : formatCurrency(p.revenueToday)}
                  </span>
                  <span className="text-muted-foreground"> today</span>
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    render={
                      <Link href="/extranet/property">
                        Manage <ArrowRight className="size-3" />
                      </Link>
                    }
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm" aria-label="Actions">
                          <MoreVertical className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem render={<Link href="/extranet/property" />}>
                        Property info
                      </DropdownMenuItem>
                      <DropdownMenuItem render={<Link href="/extranet/rates/calendar" />}>
                        Rates &amp; availability
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        render={<Link href={`/hotels/${p.id}`} target="_blank" />}
                      >
                        View public listing <ExternalLink className="size-3" />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SectionCard
        title="Portfolio performance"
        description="Occupancy and rate across the properties you manage."
      >
        <ul className="divide-y">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
              <div className="bg-muted h-2 w-32 overflow-hidden rounded-full">
                <div
                  className="bg-foreground/70 h-full rounded-full"
                  style={{ width: `${p.occupancy}%` }}
                />
              </div>
              <span className="text-muted-foreground w-28 text-right text-sm">
                {p.occupancy}% · {p.adr === null ? "—" : formatCurrency(p.adr)}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-heading text-sm font-semibold">{value}</p>
      <p className="text-muted-foreground text-xs">{label}</p>
    </div>
  )
}
