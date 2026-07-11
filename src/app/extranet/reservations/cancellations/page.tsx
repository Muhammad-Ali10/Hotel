import Link from "next/link"

import { cancellationStats } from "@/data/extranet"
import { formatCurrency } from "@/lib/format"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { CancellationsTable } from "./_components/cancellations-table"

export default function CancellationsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Cancellations"
        subtitle={`${cancellationStats.count} cancelled reservations · ${formatCurrency(
          cancellationStats.totalRefunded
        )} total refunded · ${cancellationStats.pending} pending`}
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/reservations" />}
        >
          Reservations List
        </Button>
        <Button size="sm">Cancellations</Button>
      </PageHeader>

      <CancellationsTable />
    </div>
  )
}
