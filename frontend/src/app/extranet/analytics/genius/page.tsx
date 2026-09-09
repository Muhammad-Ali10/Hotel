import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { GeniusView } from "./_components/genius-view"

export default function GeniusAnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Genius Performance" subtitle="SUBGenius Performance">
        <Button variant="outline" size="sm" render={<Link href="/extranet/analytics" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <GeniusView />
    </div>
  )
}
