"use client"

import { useAnalyticsSummary } from "@/lib/admin/api/hooks"
import { DeltaBadge } from "@/components/extranet/shared"
import { Money, SectionCard, StatusPill } from "@/components/admin/shared"
import { CardListSkeleton } from "@/components/shared/data-table"
import { EmptyState, ErrorState } from "@/components/shared/states"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const LEVEL_TONE = {
  High: "success",
  Medium: "warning",
  Low: "neutral",
} as const

export function DemandView() {
  const { data, isLoading, error, refetch } = useAnalyticsSummary()

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (isLoading || !data) return <CardListSkeleton count={1} />

  if (data.demand.length === 0) {
    return (
      <SectionCard title="Demand by city" contentClassName="px-0">
        <EmptyState
          title="No demand data yet"
          description="Search-volume figures appear once the platform has traffic in a market."
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="Demand by city"
      description="Search volume and demand levels across every market Stayora operates in"
      contentClassName="px-0"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="pl-6">City</TableHead>
            <TableHead scope="col" className="text-right">Search volume</TableHead>
            <TableHead scope="col" className="text-right">Growth</TableHead>
            <TableHead scope="col" className="text-right">Avg rate</TableHead>
            <TableHead scope="col" className="text-right">Occupancy</TableHead>
            <TableHead scope="col" className="text-right">Properties</TableHead>
            <TableHead scope="col">Demand</TableHead>
            <TableHead scope="col" className="pr-6">Top nationality</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...data.demand]
            .sort((a, b) => b.searchVolume - a.searchVolume)
            .map((city) => (
              <TableRow key={city.id}>
                <TableCell className="pl-6">
                  <span className="block font-medium">{city.city}</span>
                  <span className="text-muted-foreground block text-xs">
                    {city.country}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {Math.round(city.searchVolume / 1000)}K
                </TableCell>
                <TableCell className="text-right">
                  <DeltaBadge
                    delta={`${city.growth > 0 ? "+" : ""}${city.growth.toFixed(1)}%`}
                    trend={city.growth >= 0 ? "up" : "down"}
                    className="justify-end"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={city.avgRate} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {city.occupancy}%
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {city.properties}
                </TableCell>
                <TableCell>
                  <StatusPill status={city.level} tone={LEVEL_TONE[city.level]} />
                </TableCell>
                <TableCell className="text-muted-foreground pr-6">
                  {city.topNationality}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </SectionCard>
  )
}
