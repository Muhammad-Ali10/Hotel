import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { geniusImpact, geniusStats } from "@/data/extranet"
import { PageHeader, SectionCard, StatGrid } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"

export default function GeniusReportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Genius Report"
        subtitle="Performance of your Genius loyalty program participation"
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

      <StatGrid stats={geniusStats} className="lg:grid-cols-4" />

      <SectionCard
        title="Genius Impact Summary"
        description="How the loyalty program contributes to your performance"
      >
        <ul className="divide-y">
          {geniusImpact.map((row) => (
            <li
              key={row.label}
              className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
            >
              <span className="text-muted-foreground text-sm">{row.label}</span>
              <span className="font-heading text-lg font-semibold">
                {row.value}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
