import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { ReservationPoliciesView } from "./_components/reservation-policies-view"

export default function ReservationPoliciesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservation Policies"
        subtitle="The rules guests agree to when booking"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/property" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <ReservationPoliciesView />
    </div>
  )
}
