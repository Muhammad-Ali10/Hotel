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
        subtitle="Set prices based on the number of guests per room"
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
        Base rates shown. Click any cell to edit pricing for that guest count and
        room type combination.
      </p>
    </div>
  )
}
