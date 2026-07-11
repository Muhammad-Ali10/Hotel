import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { amenityGroups } from "@/data/extranet"
import { PageHeader } from "@/components/extranet/shared"
import { AddItemDialog } from "@/components/extranet/shared/add-item-dialog"
import { Button } from "@/components/ui/button"
import { AmenitiesManager } from "./_components/amenities-manager"

const categories = amenityGroups.map((g) => g.category)
const total = amenityGroups.reduce((s, g) => s + g.items.length, 0)
const enabled = amenityGroups.reduce(
  (s, g) => s + g.items.filter((i) => i.enabled).length,
  0
)

export default function AmenitiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Room Amenities"
        subtitle={`${enabled} of ${total} amenities enabled`}
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
          triggerLabel="Add Amenity"
          title="Add Amenity"
          nameLabel="Amenity Name"
          namePlaceholder="e.g. Bathrobe"
          categories={categories}
        />
      </PageHeader>

      <AmenitiesManager />
    </div>
  )
}
