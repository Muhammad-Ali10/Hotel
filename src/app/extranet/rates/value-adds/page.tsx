import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { ValueAddsGrid } from "./_components/value-adds-grid"

export default function ValueAddsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Value Adds"
        subtitle="Optional extras guests can buy when they book"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/rates" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <ValueAddsGrid />
    </div>
  )
}
