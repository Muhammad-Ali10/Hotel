import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { ContractsView } from "./_components/contracts-view"

export default function ContractsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contracts"
        subtitle="View and manage your contractual agreements"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/account" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <ContractsView />
    </div>
  )
}
