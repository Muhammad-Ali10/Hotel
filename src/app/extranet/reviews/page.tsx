import { Download, Settings2 } from "lucide-react"

import type { Stat } from "@/lib/extranet/types"
import { reviewStats } from "@/data/extranet"
import { ActionButton, PageHeader, StatGrid } from "@/components/extranet/shared"
import { ReviewsList } from "./_components/reviews-list"

const fiveStarPct = Math.round((reviewStats.fiveStar / reviewStats.total) * 100)

const stats: Stat[] = [
  { label: "Total Reviews", value: String(reviewStats.total) },
  { label: "Avg. Rating", value: `${reviewStats.avgRating} / 5` },
  { label: "Pending Review", value: String(reviewStats.pending) },
  { label: "Response Rate", value: `${reviewStats.responseRate}%` },
  { label: "5-Star Reviews", value: `${reviewStats.fiveStar} (${fiveStarPct}%)` },
  { label: "Flagged", value: String(reviewStats.flagged) },
]

export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Guest Reviews"
        subtitle="Manage and respond to guest reviews across all properties"
      >
        <ActionButton
          variant="outline"
          size="sm"
          toastMessage="Exporting reviews…"
          toastType="info"
        >
          <Download className="size-4" />
          Export
        </ActionButton>
        <ActionButton
          variant="outline"
          size="sm"
          toastMessage="Opening review settings…"
          toastType="info"
        >
          <Settings2 className="size-4" />
          Review Settings
        </ActionButton>
      </PageHeader>

      <StatGrid stats={stats} className="sm:grid-cols-3 lg:grid-cols-6" />

      <ReviewsList />
    </div>
  )
}
