"use client"

import * as React from "react"

import type { Stat } from "@/lib/extranet/types"
import { formatCurrency } from "@/lib/format"
import { addDays, toISODate } from "@/lib/domain"
import {
  usePartnerBookings,
  usePartnerReviews,
  usePerformance,
} from "@/lib/api/hooks"
import { PageHeader, StatGrid } from "@/components/extranet/shared"

/**
 * The dashboard header.
 *
 * The Export button is gone. It fired a toast that said "Exporting dashboard
 * summary…" and nothing followed — no file, no email, no job. So did "New
 * Reservation", which opened a form that wrote to a browser store: a booking
 * has to hold inventory, take payment and pass the overbooking check inside
 * one transaction, none of which a dialog on this screen can do. A property
 * taking a reservation by phone books it as a guest would, or the front desk
 * does it in the reservations list, where the API is the one deciding.
 */
export function ExtranetDashboardHeader() {
  const today = new Date()

  return (
    <PageHeader
      title="Dashboard"
      subtitle={`Across every property · ${today.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`}
    />
  )
}

/**
 * Today, and the last thirty nights.
 *
 * Arrivals, departures and in-house are counted from the booking list — the
 * same rows the Reservations screen shows — so the tile and the table can
 * never disagree. Occupancy and revenue come from `performance`, which is what
 * Property Performance and the property strip read.
 *
 * "Today's revenue" is deliberately not here. A single day's takings is either
 * zero or an outlier depending on when a booking happened to land, and the old
 * tile presented it as a group total, which is the least informative number on
 * a page full of them.
 */
export function ExtranetDashboardStats() {
  const bookings = usePartnerBookings()
  const reviews = usePartnerReviews("published")

  const range = React.useMemo(() => {
    const iso = toISODate(new Date())
    return { from: addDays(iso, -29), to: iso }
  }, [])
  const performance = usePerformance(range)

  const today = toISODate(new Date())
  const all = bookings.data ?? []

  const arrivals = all.filter(
    (b) => b.checkIn === today && b.status !== "cancelled"
  ).length
  const departures = all.filter(
    (b) => b.checkOut === today && b.status !== "cancelled"
  ).length
  const inHouse = all.filter(
    (b) =>
      b.checkIn <= today &&
      b.checkOut > today &&
      (b.status === "checked_in" || b.status === "confirmed")
  ).length

  const rows = performance.data ?? []
  const roomNights = rows.reduce((sum, r) => sum + r.roomNights, 0)
  const available = rows.reduce((sum, r) => sum + r.roomNightsAvailable, 0)
  /*
   * Weighted by capacity, not averaged across properties.
   *
   * Averaging each property's own percentage lets a four-room guesthouse at
   * 100% cancel out a 300-room hotel at 50%.
   */
  const occupancy = available === 0 ? 0 : Math.round((roomNights / available) * 100)

  const revenue = rows.reduce<number | null>(
    (sum, r) => (sum === null || r.revenue === null ? null : sum + r.revenue),
    0
  )

  // `response` is the partner's public reply — its absence is the work queue.
  const awaitingReply = (reviews.data?.items ?? []).filter(
    (r) => r.response === null
  ).length

  const dash = (value: string) => (bookings.isPending ? "—" : value)

  const stats: Stat[] = [
    {
      label: "Arrivals today",
      value: dash(String(arrivals)),
      caption: "across every property",
      icon: "CalendarCheck",
    },
    {
      label: "Departures today",
      value: dash(String(departures)),
      caption: "checking out",
      icon: "LogOut",
    },
    {
      label: "In house",
      value: dash(String(inHouse)),
      caption: "staying tonight",
      icon: "Users",
    },
    {
      label: "Revenue, 30 days",
      value: performance.isPending
        ? "—"
        : revenue === null
          ? "—"
          : formatCurrency(revenue),
      caption: "gross, by night stayed",
      icon: "Wallet",
    },
    {
      label: "Occupancy, 30 days",
      value: performance.isPending ? "—" : `${occupancy}%`,
      caption: `${roomNights} of ${available} nights`,
      icon: "TrendingUp",
    },
    {
      label: "Reviews to answer",
      value: reviews.isPending ? "—" : String(awaitingReply),
      caption: "published, no reply yet",
      icon: "Star",
    },
  ]

  return <StatGrid stats={stats} />
}
