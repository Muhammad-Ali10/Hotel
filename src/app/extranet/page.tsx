import { Download } from "lucide-react"

import { dashboardDate, dashboardStats } from "@/data/extranet"
import { ActionButton, PageHeader, StatGrid } from "@/components/extranet/shared"
import { PropertyStrip } from "./_components/property-strip"
import { OverviewCharts } from "./_components/overview-charts"
import { NewReservationDialog } from "./_components/new-reservation-dialog"
import {
  PendingActions,
  RecentReservations,
  Tips,
  UpcomingCheckIns,
} from "./_components/dashboard-lists"

export default function ExtranetDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle={`Aggregated overview across all properties · ${dashboardDate}`}
      >
        <ActionButton
          variant="outline"
          size="sm"
          toastType="info"
          toastMessage="Exporting dashboard summary…"
        >
          <Download className="size-4" />
          Export
        </ActionButton>
        <NewReservationDialog />
      </PageHeader>

      <StatGrid stats={dashboardStats} />

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
