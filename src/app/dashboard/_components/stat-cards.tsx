"use client"

import { CalendarCheck, Heart, Plane, Sparkles, type LucideIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { useDashboardStats } from "@/store/selectors"
import { Card, CardContent } from "@/components/ui/card"

/** Every tile is derived from the store — "Saved Hotels: 4" used to sit above a
 *  Favorites page that listed six. */
export function StatCards() {
  const stats = useDashboardStats()

  const tiles: { label: string; value: string; icon: LucideIcon }[] = [
    { label: "Upcoming Trips", value: String(stats.upcomingTrips), icon: Plane },
    { label: "Reviews Written", value: String(stats.reviewsWritten), icon: CalendarCheck },
    { label: "Saved Hotels", value: String(stats.savedHotels), icon: Heart },
    { label: "Reward Points", value: formatNumber(stats.rewardPoints), icon: Sparkles },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="space-y-4">
            <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
              <stat.icon className="size-5" />
            </span>
            <div>
              <p className="font-heading text-3xl font-semibold tracking-tight">{stat.value}</p>
              <p className="text-muted-foreground mt-0.5 text-sm">{stat.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
