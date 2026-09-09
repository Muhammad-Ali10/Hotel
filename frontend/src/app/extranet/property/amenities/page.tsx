import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { AmenityToggles } from "@/components/extranet/amenity-toggles"
import { Button } from "@/components/ui/button"

export default function AmenitiesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Room Amenities"
        subtitle="What guests get in the room itself"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/property" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
        {/*
          There is no "Add Amenity" button any more.
          The vocabulary is the platform's (rule #74): a partner who could add
          their own would add "Wi-Fi" beside the existing "wifi", and the
          filter that used to find every hotel with internet would find half.
        */}
      </PageHeader>

      <AmenityToggles scope="room" noun="amenities" />
    </div>
  )
}
