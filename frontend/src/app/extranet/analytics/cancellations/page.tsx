import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { CancellationsView } from "./_components/cancellations-view"

export default function CancellationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Cancellations" subtitle="SUBCancellations">
        <Button variant="outline" size="sm" render={<Link href="/extranet/analytics" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <CancellationsView />
    </div>
  )
}
