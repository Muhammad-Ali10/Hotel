import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { PaceView } from "./_components/pace-view"

export default function PacePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Booking Pace"
        subtitle="What has been stayed, and what is on the books ahead"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/analytics" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <PaceView />
    </div>
  )
}
