import Link from "next/link"

import { reservations } from "@/data/extranet"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { ReservationsTable } from "./_components/reservations-table"

export default function ReservationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservations"
        subtitle={`${reservations.length} total reservations · ${reservations.length} matching`}
      >
        <Button size="sm" render={<Link href="/extranet/reservations" />}>
          Reservations List
        </Button>
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/reservations/cancellations" />}
        >
          Cancellations
        </Button>
      </PageHeader>

      <ReservationsTable />
    </div>
  )
}
