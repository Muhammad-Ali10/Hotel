import { Suspense } from "react"
import type { Metadata } from "next"

import { DataTableSkeleton } from "@/components/shared/data-table"
import { ReservationsView } from "./_components/reservations-view"

export const metadata: Metadata = { title: "Reservations · Stayora Admin" }

export default function AdminReservationsPage() {
  return (
    // `useSearchParams` in the view needs a Suspense boundary to stay static.
    <Suspense fallback={<DataTableSkeleton columns={10} />}>
      <ReservationsView />
    </Suspense>
  )
}
