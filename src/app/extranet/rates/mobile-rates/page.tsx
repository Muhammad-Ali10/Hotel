import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { mobileRates } from "@/data/extranet"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import {
  CreateMobileRateButton,
  MobileRatesList,
} from "./_components/mobile-rates-view"

const activeCount = mobileRates.filter((m) => m.status === "Active").length

export default function MobileRatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Mobile Rates"
        subtitle={`Exclusive rates for mobile app users · ${activeCount} active`}
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/rates" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <CreateMobileRateButton />
      </PageHeader>

      <MobileRatesList />
    </div>
  )
}
