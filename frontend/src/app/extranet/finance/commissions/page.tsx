import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { CommissionsView } from "./_components/commissions-view"

export default function CommissionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Commissions" subtitle="SUBCommissions">
        <Button variant="outline" size="sm" render={<Link href="/extranet/finance" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <CommissionsView />
    </div>
  )
}
