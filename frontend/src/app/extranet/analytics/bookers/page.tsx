import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { BookersView } from "./_components/bookers-view"

export default function BookersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Who Books" subtitle="SUBWho Books">
        <Button variant="outline" size="sm" render={<Link href="/extranet/analytics" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <BookersView />
    </div>
  )
}
