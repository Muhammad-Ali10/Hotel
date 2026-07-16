"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ExternalLink, MapPin, MoreVertical, Plus, Users } from "lucide-react"

import type { Stat } from "@/lib/extranet/types"
import { usePartnerPortfolio } from "@/store/selectors"
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
export function PropertiesView() {
  const portfolio = usePartnerPortfolio()

  const stats: Stat[] = [
    {
      label: "Total Properties",
      value: String(portfolio.totalProperties),
      caption: `${portfolio.totalProperties} active`,
    },
    {
      label: "Total Rooms",
      value: String(portfolio.totalRooms),
      caption: `${portfolio.occupancy}% avg occupancy`,
    },
    {
      label: "Arrivals Today",
      value: String(portfolio.todaysArrivals),
      caption: "across all properties",
    },
    {
      label: "Today's Revenue",
      value: formatCurrency(portfolio.todaysRevenue),
      caption: "group total",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle={`Portfolio Management · ${portfolio.totalProperties} properties`}
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
        {portfolio.rows.map((p) => (
          <Card key={p.id} className="overflow-hidden py-0">
            <div className="relative aspect-[16/9] w-full">
              <Image
                src={hotelImage(p.seed, 640, 360)}
                alt={p.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                className="object-cover"
              />
              <span className="absolute top-3 left-3">
                <Badge className="border-transparent bg-emerald-500/20 text-emerald-100 backdrop-blur">
                  Active
                </Badge>
              </span>
            </div>
            <CardContent className="space-y-4 py-4">
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading text-base font-semibold">{p.name}</h3>
                  <div className="shrink-0 pt-1">
                    {p.reviewCount > 0 ? (
                      <StarRating rating={p.rating} size="size-3.5" />
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
                <Metric label="ADR" value={formatCurrency(p.adr)} />
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">
                  <span className="font-heading font-semibold">
                    {formatCurrency(p.revenueToday)}
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
          {portfolio.rows.map((p) => (
            <li key={p.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
              <div className="bg-muted h-2 w-32 overflow-hidden rounded-full">
                <div
                  className="bg-foreground/70 h-full rounded-full"
                  style={{ width: `${p.occupancy}%` }}
                />
              </div>
              <span className="text-muted-foreground w-28 text-right text-sm">
                {p.occupancy}% · {formatCurrency(p.adr)}
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
