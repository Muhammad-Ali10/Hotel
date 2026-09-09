import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { RevenueView } from "./_components/revenue-view"

export default function RevenuePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Revenue" subtitle="SUBRevenue">
        <Button variant="outline" size="sm" render={<Link href="/extranet/finance" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <RevenueView />
    </div>
  )
}
