import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { facilityGroups } from "@/data/extranet"
import { PageHeader, ToggleGroupsManager } from "@/components/extranet/shared"
import { AddItemDialog } from "@/components/extranet/shared/add-item-dialog"
import { Button } from "@/components/ui/button"

const total = facilityGroups.reduce((s, g) => s + g.items.length, 0)
const enabled = facilityGroups.reduce(
  (s, g) => s + g.items.filter((i) => i.enabled).length,
  0
)
const categories = facilityGroups.map((g) => g.category)

export default function FacilitiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Facilities & Services"
        subtitle={`${enabled} of ${total} facilities enabled`}
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/property" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <AddItemDialog
          triggerLabel="Add Facility"
          title="Add Facility"
          nameLabel="Facility Name"
          namePlaceholder="e.g. Rooftop pool"
          categories={categories}
        />
      </PageHeader>

      <ToggleGroupsManager groups={facilityGroups} noun="facilities" />
    </div>
  )
}
