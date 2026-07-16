"use client"

import { Download } from "lucide-react"

import type { Stat } from "@/lib/extranet/types"
import { formatCurrency } from "@/lib/format"
import { toISODate } from "@/lib/domain"
import { usePartnerPortfolio, usePartnerReservations, usePartnerStats } from "@/store/selectors"
import { ActionButton, PageHeader, StatGrid } from "@/components/extranet/shared"
import { NewReservationDialog } from "./new-reservation-dialog"

/**
 * The dashboard header and KPI tiles, counted from the store.
 *
 * These were hardcoded ("52 bookings", "$17,122", "25 pending reviews") under a
 * date a month adrift from the rest of the app, so the tiles disagreed with the
 * Properties screen and the Reviews screen that derive the same figures.
 */
export function ExtranetDashboardHeader() {
  const today = new Date()

  return (
    <PageHeader
      title="Dashboard"
      subtitle={`Aggregated overview across all properties · ${today.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`}
    >
      <ActionButton
        variant="outline"
        size="sm"
        toastType="info"
        toastMessage="Exporting dashboard summary…"
      >
        <Download className="size-4" />
        Export
      </ActionButton>
      <NewReservationDialog />
    </PageHeader>
  )
}

export function ExtranetDashboardStats() {
  const portfolio = usePartnerPortfolio()
  const reservations = usePartnerReservations()
  const { pendingReviews, awaitingReply } = usePartnerStats()
  const today = toISODate(new Date())

  const departures = reservations.filter((r) => r.checkOut === today).length
  const inHouse = reservations.filter(
    (r) => r.checkIn <= today && r.checkOut > today && r.status !== "pending"
  ).length

  const stats: Stat[] = [
    {
      label: "Arrivals Today",
      value: String(portfolio.todaysArrivals),
      caption: "across all properties",
      icon: "CalendarCheck",
    },
    {
      label: "Departures Today",
      value: String(departures),
      caption: "checking out",
      icon: "LogOut",
    },
    {
      label: "In House",
      value: String(inHouse),
      caption: "guests staying tonight",
      icon: "Users",
    },
    {
      label: "Today's Revenue",
      value: formatCurrency(portfolio.todaysRevenue),
      caption: "group total",
      icon: "Wallet",
    },
    {
      label: "Occupancy Rate",
      value: `${portfolio.occupancy}%`,
      caption: `${portfolio.totalRooms} rooms`,
      icon: "TrendingUp",
    },
    {
      label: "Reviews To Action",
      value: String(pendingReviews + awaitingReply),
      caption: `${pendingReviews} pending · ${awaitingReply} awaiting reply`,
      icon: "Star",
    },
  ]

  return <StatGrid stats={stats} />
}
