import { PageHeader } from "@/components/extranet/shared"
import { AnalyticsNav } from "./_components/analytics-nav"
import { AnalyticsOverview } from "./_components/analytics-overview"

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        subtitle="Trading across your portfolio, for a window you choose"
      />

      <AnalyticsNav />

      <AnalyticsOverview />
    </div>
  )
}
