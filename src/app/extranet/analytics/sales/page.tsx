import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { salesStats, salesTrend } from "@/data/extranet"
import { PageHeader, SectionCard, StatGrid } from "@/components/extranet/shared"
import { BarChart } from "@/components/extranet/charts"
import { Button } from "@/components/ui/button"

export default function SalesStatisticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Statistics"
        subtitle="Detailed revenue and sales performance metrics"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/analytics" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <StatGrid stats={salesStats} className="sm:grid-cols-3 lg:grid-cols-6" />

      <SectionCard title="Monthly Revenue Trend" description="Last 6 months">
        <BarChart
          data={salesTrend}
          formatTick={(n) => `$${Math.round(n / 1000)}k`}
        />
      </SectionCard>
    </div>
  )
}
