import { Download, Settings2 } from "lucide-react"

import { ActionButton, PageHeader } from "@/components/extranet/shared"
import { ReviewsList } from "./_components/reviews-list"
import { ReviewsStats } from "./_components/reviews-stats"

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

      <ReviewsStats />

      <ReviewsList />
    </div>
  )
}
