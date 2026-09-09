import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { PerformanceView } from "./_components/performance-view"

export default function PropertyPerformancePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Property Performance" subtitle="SUBProperty Performance">
        <Button variant="outline" size="sm" render={<Link href="/extranet/analytics" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <PerformanceView />
    </div>
  )
}
