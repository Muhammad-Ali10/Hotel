import { DashboardSkeleton } from "./_components/dashboard-view"

/** Route-level fallback while the admin bundle streams in. */
export default function AdminLoading() {
  return <DashboardSkeleton />
}
