import { PropertyStrip } from "./_components/property-strip"
import { OverviewCharts } from "./_components/overview-charts"
import {
  ExtranetDashboardHeader,
  ExtranetDashboardStats,
} from "./_components/dashboard-header"
import {
  PendingActions,
  RecentReservations,
  Tips,
  UpcomingCheckIns,
} from "./_components/dashboard-lists"

export default function ExtranetDashboardPage() {
  return (
    <div className="space-y-8">
      <ExtranetDashboardHeader />

      <ExtranetDashboardStats />

      <PropertyStrip />

      <OverviewCharts />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentReservations />
        </div>
        <div className="space-y-6">
          <UpcomingCheckIns />
          <PendingActions />
        </div>
      </div>

      <Tips />
    </div>
  )
}
