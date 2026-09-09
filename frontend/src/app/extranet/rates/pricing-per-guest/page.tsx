import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { PricingGrid } from "./_components/pricing-grid"

export default function PricingPerGuestPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pricing Per Guest"
        subtitle="What a room costs at each occupancy, per rate plan"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/rates" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <PricingGrid />

      <p className="text-muted-foreground text-sm">
        Levels run from one guest up to what the room sleeps. A level you have not
        set is charged at the plan&apos;s own price.
      </p>
    </div>
  )
}
