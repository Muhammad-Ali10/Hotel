import { PropertyStrip } from "./_components/property-strip"
import { OverviewCharts } from "./_components/overview-charts"
import {
  ExtranetDashboardHeader,
  ExtranetDashboardStats,
} from "./_components/dashboard-header"
import {
  PendingActions,
  RecentReservations,
  UpcomingCheckIns,
} from "./_components/dashboard-lists"

export default function ExtranetDashboardPage() {
  return (
    <div className="space-y-8">
      <ExtranetDashboardHeader />

      <ExtranetDashboardStats />

      <PropertyStrip />

      <OverviewCharts />

      {/*
        `min-w-0` on the grid children, not decoration.
        A grid item's `min-width` defaults to `auto`, which means "never narrower
        than my content" — so the reservations table inside stretched its column
        to 656px on a 390px phone and took the whole page sideways with it. With
        `min-w-0` the column obeys the grid, and the table scrolls inside its own
        wrapper, which is what that wrapper is for.
      */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <RecentReservations />
        </div>
        <div className="min-w-0 space-y-6">
          <UpcomingCheckIns />
          <PendingActions />
        </div>
      </div>

    </div>
  )
}
