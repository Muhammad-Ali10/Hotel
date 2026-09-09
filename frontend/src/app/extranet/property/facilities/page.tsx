import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { AmenityToggles } from "@/components/extranet/amenity-toggles"
import { Button } from "@/components/ui/button"

export default function FacilitiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Facilities & Services"
        subtitle="What the property offers beyond the room"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/property" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <AmenityToggles scope="facilities" noun="facilities" />
    </div>
  )
}
