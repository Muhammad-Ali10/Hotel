import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { DiscountSimulator } from "./_components/discount-simulator"

export default function SimulateDiscountPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Simulate Max Discount"
        subtitle="Calculate your maximum discount while maintaining profitability"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/promotions" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <DiscountSimulator />
    </div>
  )
}
