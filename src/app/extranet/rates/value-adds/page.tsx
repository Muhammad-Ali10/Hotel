import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { valueAddsActive } from "@/data/extranet"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { AddValueAddDialog } from "./_components/add-value-add-dialog"
import { ValueAddsGrid } from "./_components/value-adds-grid"

export default function ValueAddsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Value Adds"
        subtitle={`Enhance bookings with optional add-on services · ${valueAddsActive} active`}
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/rates" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <AddValueAddDialog />
      </PageHeader>

      <ValueAddsGrid />
    </div>
  )
}
