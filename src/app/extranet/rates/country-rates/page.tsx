import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { countryRates } from "@/data/extranet"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import {
  AddCountryButton,
  CountryRatesTable,
} from "./_components/country-rates-view"

export default function CountryRatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Country Rates"
        subtitle={`Geo-targeted pricing for ${countryRates.length} countries`}
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/rates" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <AddCountryButton />
      </PageHeader>

      <CountryRatesTable />
    </div>
  )
}
