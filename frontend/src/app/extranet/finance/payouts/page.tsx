import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { PayoutsView } from "./_components/payouts-view"

export default function PayoutsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Payouts" subtitle="SUBPayouts">
        <Button variant="outline" size="sm" render={<Link href="/extranet/finance" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <PayoutsView />
    </div>
  )
}
