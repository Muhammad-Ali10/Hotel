import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { ComparablesView } from "./_components/comparables-view"

export default function ComparablesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Market Comparison" subtitle="SUBMarket Comparison">
        <Button variant="outline" size="sm" render={<Link href="/extranet/analytics" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <ComparablesView />
    </div>
  )
}
