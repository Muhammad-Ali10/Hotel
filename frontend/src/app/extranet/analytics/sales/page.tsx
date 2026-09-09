import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { SalesView } from "./_components/sales-view"

export default function SalesStatisticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Statistics"
        subtitle="What was booked, and what it earned — by the date of the booking"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/analytics" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <SalesView />
    </div>
  )
}
