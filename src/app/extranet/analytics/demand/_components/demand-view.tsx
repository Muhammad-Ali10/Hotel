"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import type { Stat } from "@/lib/extranet/types"
import { demandCities } from "@/data/extranet"
import { formatCurrency, formatNumber } from "@/lib/format"
import { cn } from "@/lib/utils"
import { PageHeader, SectionCard, StatGrid } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"

export function DemandView() {
  const [activeId, setActiveId] = React.useState("zermatt")
  const city = demandCities.find((c) => c.id === activeId) ?? demandCities[0]
  const maxShare = Math.max(...city.sources.map((s) => s.share))

  const stats: Stat[] = [
    { label: "Monthly Searches", value: formatNumber(city.monthlySearches) },
    { label: "Your Bookings", value: formatNumber(city.yourBookings) },
    { label: "Market Avg. Rate", value: formatCurrency(city.marketAvgRate) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Demand for ${city.city}`}
        subtitle="Search demand and market insights for your location"
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

      <div className="flex flex-wrap gap-2">
        {demandCities.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveId(c.id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              activeId === c.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {c.city}
          </button>
        ))}
      </div>

      <StatGrid stats={stats} className="lg:grid-cols-3" />

      <SectionCard
        title="Top Source Markets"
        description={`Where ${city.city} demand comes from`}
      >
        <ul className="space-y-3.5">
          {city.sources.map((s) => (
            <li key={s.country} className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span>{s.country}</span>
                <span className="font-medium">{s.share}%</span>
              </div>
              <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                <div
                  className="bg-foreground h-full rounded-full"
                  style={{ width: `${(s.share / maxShare) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
