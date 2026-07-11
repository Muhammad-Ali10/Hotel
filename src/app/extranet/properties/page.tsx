import Image from "next/image"
import Link from "next/link"
import { ArrowRight, MapPin, MoreVertical, Plus, Star, Users } from "lucide-react"

import type { Stat } from "@/lib/extranet/types"
import { properties, portfolioStats } from "@/data/extranet"
import { hotelImage } from "@/lib/images"
import { formatCurrency } from "@/lib/format"
import {
  PageHeader,
  SectionCard,
  StatGrid,
  StatusPill,
} from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const avgOccupancy = Math.round(
  properties.reduce((sum, p) => sum + p.occupancy, 0) / properties.length
)

const stats: Stat[] = [
  {
    label: "Total Properties",
    value: String(portfolioStats.totalProperties),
    caption: `${portfolioStats.totalProperties} active`,
  },
  {
    label: "Total Rooms",
    value: String(portfolioStats.totalRooms),
    caption: `${avgOccupancy}% avg occupancy`,
  },
  {
    label: "Today's Bookings",
    value: String(portfolioStats.todaysBookings),
    caption: "across all properties",
  },
  {
    label: "Today's Revenue",
    value: formatCurrency(portfolioStats.todaysRevenue),
    caption: "group total",
  },
]

export default function PropertiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        subtitle={`Portfolio Management · ${properties.length} properties`}
      >
        <Button variant="outline" size="sm">
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
        {properties.map((p) => (
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
                <StatusPill status={p.status} />
              </span>
            </div>
            <CardContent className="space-y-4 py-4">
              <div className="space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading text-base font-semibold">
                    {p.name}
                  </h3>
                  <div className="flex shrink-0 gap-0.5 pt-1">
                    {Array.from({ length: p.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="size-3.5 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                </div>
                <p className="text-muted-foreground flex items-center gap-1 text-sm">
                  <MapPin className="size-3.5" />
                  {p.city}, {p.country}
                </p>
              </div>

              <div className="bg-muted/40 grid grid-cols-3 gap-2 rounded-lg p-3 text-center">
                <div>
                  <p className="text-sm font-semibold">{p.rooms}</p>
                  <p className="text-muted-foreground text-xs">Rooms</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{p.occupancy}%</p>
                  <p className="text-muted-foreground text-xs">Occupancy</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {formatCurrency(p.adr)}
                  </p>
                  <p className="text-muted-foreground text-xs">ADR</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button size="sm" className="flex-1">
                  Switch to This Property
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="icon-sm"
                        aria-label="Property actions"
                      >
                        <MoreVertical className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      render={<Link href="/extranet/property" />}
                    >
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/extranet/rates" />}>
                      Manage Rates
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive">
                      Deactivate
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SectionCard
        title="Group Performance Summary"
        description="Last 30 days — all properties"
        action={
          <Link
            href="/extranet/finance"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm font-medium"
          >
            View detailed report <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        <ul className="divide-y">
          {properties.map((p) => {
            const bookings = Math.round(p.revenueToday / p.adr)
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {p.city}
                  </p>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="hidden sm:inline">
                    <span className="font-medium">{bookings}</span>{" "}
                    <span className="text-muted-foreground">bookings</span>
                  </span>
                  <span className="font-medium">
                    {formatCurrency(p.revenueToday)}
                  </span>
                  <span className="text-muted-foreground w-12 text-right">
                    {p.occupancy}%
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </SectionCard>
    </div>
  )
}
