import {
  analyticsInsights,
  analyticsMonthly,
  analyticsStats,
} from "@/data/extranet"
import { PageHeader, SectionCard, StatGrid, Icon } from "@/components/extranet/shared"
import { BarChart } from "@/components/extranet/charts"
import { Card, CardContent } from "@/components/ui/card"
import { AnalyticsNav } from "./_components/analytics-nav"

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics Dashboard"
        subtitle="Performance overview for the last 12 months"
      />

      <AnalyticsNav />

      <StatGrid stats={analyticsStats} className="sm:grid-cols-3 lg:grid-cols-6" />

      <SectionCard title="Revenue Trend" description="Last 12 months">
        <BarChart
          data={analyticsMonthly}
          formatTick={(n) => `$${Math.round(n / 1000)}k`}
        />
      </SectionCard>

      <section className="space-y-4">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Key Insights
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {analyticsInsights.map((insight) => (
            <Card key={insight.title}>
              <CardContent className="space-y-3">
                <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
                  <Icon name={insight.icon} className="size-4" />
                </span>
                <div className="space-y-1">
                  <p className="font-medium">{insight.title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
