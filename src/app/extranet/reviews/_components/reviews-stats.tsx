"use client"

import type { Stat } from "@/lib/extranet/types"
import { usePartnerReviews } from "@/store/selectors"
import { deriveRating } from "@/lib/domain"
import { StatGrid } from "@/components/extranet/shared"

/** Every figure is derived from the same review list the page below renders —
 *  the KPIs and the property-score page used to quote different averages and
 *  different pending counts for the same portfolio. */
export function ReviewsStats() {
  const reviews = usePartnerReviews()
  const published = reviews.filter((r) => r.status === "published")

  const total = reviews.length
  const pending = reviews.filter((r) => r.status === "pending").length
  const flagged = reviews.filter((r) => r.status === "flagged").length
  const fiveStar = published.filter((r) => r.rating === 5).length
  const responded = published.filter((r) => r.response).length

  const stats: Stat[] = [
    { label: "Total Reviews", value: String(total) },
    { label: "Avg. Rating", value: `${deriveRating(published).rating} / 5` },
    { label: "Pending Review", value: String(pending) },
    {
      label: "Response Rate",
      value: published.length ? `${Math.round((responded / published.length) * 100)}%` : "—",
    },
    {
      label: "5-Star Reviews",
      value: published.length
        ? `${fiveStar} (${Math.round((fiveStar / published.length) * 100)}%)`
        : "0",
    },
    { label: "Flagged", value: String(flagged) },
  ]

  return <StatGrid stats={stats} className="sm:grid-cols-3 lg:grid-cols-6" />
}
