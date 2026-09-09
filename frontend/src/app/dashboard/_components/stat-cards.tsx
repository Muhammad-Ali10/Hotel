"use client"

import { CalendarCheck, Heart, Plane, Sparkles, type LucideIcon } from "lucide-react"

import { formatNumber } from "@/lib/format"
import { toISODate } from "@/lib/domain"
import { useFavorites, useMyBookings, useMyReviews, useProfile } from "@/lib/api/hooks"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Four tiles, every one of them counted from what the server returned.
 *
 * They used to be derived from a zustand store filled with fixtures — so
 * "Saved Hotels: 4" sat above a Favorites page listing six, and none of the
 * numbers described the person reading them.
 *
 * A tile shows `—` while its own query is still in flight rather than `0`:
 * zero is a claim ("you have no upcoming trips"), and making it for a second
 * on every load is a claim the page cannot support yet.
 */
export function StatCards() {
  const bookings = useMyBookings()
  const favorites = useFavorites()
  const reviews = useMyReviews()
  const profile = useProfile()

  const today = toISODate(new Date())
  const upcoming = (bookings.data ?? []).filter(
    (b) => b.checkIn >= today && b.status !== "cancelled" && b.status !== "no_show"
  ).length

  const tiles: { label: string; value: string; icon: LucideIcon }[] = [
    {
      label: "Upcoming Trips",
      value: bookings.isPending ? "—" : String(upcoming),
      icon: Plane,
    },
    {
      label: "Reviews Written",
      value: reviews.isPending ? "—" : String(reviews.data?.items.length ?? 0),
      icon: CalendarCheck,
    },
    {
      label: "Saved Hotels",
      value: favorites.isPending ? "—" : String(favorites.data?.items.length ?? 0),
      icon: Heart,
    },
    {
      label: "Reward Points",
      value: profile.isPending ? "—" : formatNumber(profile.data?.points ?? 0),
      icon: Sparkles,
    },
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
