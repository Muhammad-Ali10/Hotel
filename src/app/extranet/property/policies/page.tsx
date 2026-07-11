import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { PoliciesView } from "./_components/policies-view"

export default function PoliciesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Policies"
        subtitle="Cancellation, house rules, check-in times"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/property" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <PoliciesView />
    </div>
  )
}
