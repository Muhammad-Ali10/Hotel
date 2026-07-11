import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { DescriptionsList } from "./_components/descriptions-view"

export default function DescriptionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="View Your Descriptions"
        subtitle="See how your property descriptions appear to guests on the platform"
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

      <DescriptionsList />
    </div>
  )
}
