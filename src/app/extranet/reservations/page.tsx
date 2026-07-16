import { ReservationsHeader } from "./_components/reservations-header"
import { ReservationsTable } from "./_components/reservations-table"

export default function ReservationsPage() {
  return (
    <div className="space-y-6">
      <ReservationsHeader />
      <ReservationsTable />
    </div>
  )
}
