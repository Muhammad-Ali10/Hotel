import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { VatTaxHeaderAction, VatTaxTable } from "./_components/vat-tax-view"

export default function VatTaxPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="VAT / Tax / Charges"
        subtitle="Configure taxes and additional charges for your properties"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/property" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <VatTaxHeaderAction />
      </PageHeader>

      <VatTaxTable />
    </div>
  )
}
