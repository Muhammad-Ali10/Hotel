import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { CopyRatesForm } from "./_components/copy-rates-form"

export default function CopyRatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Copy Rates to Future Dates"
        subtitle="Copy rate plans and restrictions from one date range to another"
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

      <CopyRatesForm />
    </div>
  )
}
