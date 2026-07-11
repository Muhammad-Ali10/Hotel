import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { restrictionRules } from "@/data/extranet"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import {
  NewRuleButton,
  RestrictionsTable,
} from "./_components/restrictions-view"

export default function RestrictionRulesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dynamic Restriction Rules"
        subtitle={`${restrictionRules.length} active rules · Control booking restrictions dynamically`}
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/rates" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <NewRuleButton />
      </PageHeader>

      <RestrictionsTable />
    </div>
  )
}
