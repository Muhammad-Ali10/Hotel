import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { RestrictionsView } from "./_components/restrictions-view"

export default function RestrictionRulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Restrictions"
        subtitle="Minimum and maximum stays, arrival and departure closures, advance notice"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/rates" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <RestrictionsView />
    </div>
  )
}
