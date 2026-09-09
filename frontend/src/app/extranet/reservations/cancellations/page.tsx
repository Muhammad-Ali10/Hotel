import { CancellationsHeader } from "../_components/reservations-header"
import { CancellationsTable } from "./_components/cancellations-table"

export default function CancellationsPage() {
  return (
    <div className="space-y-6">
      <CancellationsHeader />
      <CancellationsTable />
    </div>
  )
}
