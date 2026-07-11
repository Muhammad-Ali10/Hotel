import { bookingSources, revenueSeries, weeklyOccupancy } from "@/data/extranet"
import { SectionCard } from "@/components/extranet/shared"
import { BarChart, DonutChart } from "@/components/extranet/charts"

export function OverviewCharts() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <SectionCard
        title="Revenue Overview"
        description="Last 6 months"
        className="lg:col-span-2"
      >
        <BarChart
          data={revenueSeries}
          showLine
          formatTick={(n) => `$${Math.round(n / 1000)}k`}
          legendPrimary="Revenue"
          legendSecondary="Bookings"
        />
      </SectionCard>

      <SectionCard title="Booking Sources" description="5 sources">
        <DonutChart data={bookingSources} />
      </SectionCard>

      <SectionCard
        title="Weekly Occupancy"
        description="This week"
        className="lg:col-span-3"
      >
        <BarChart
          data={weeklyOccupancy}
          maxValue={100}
          showValueLabels
          valueSuffix="%"
        />
      </SectionCard>
    </div>
  )
}
