"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Download } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatRelativeTime } from "@/lib/format"
import { useOverview } from "@/lib/admin/api/hooks"
import { BarChart } from "@/components/extranet/charts"
import {
  ActionButton,
  AdminPageHeader,
  Money,
  SectionCard,
  StatGrid,
} from "@/components/admin/shared"
import { ErrorState } from "@/components/shared/states"
import {
  CardListSkeleton,
  Skeleton,
  StatGridSkeleton,
} from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function DashboardView() {
  const [range, setRange] = React.useState<"6M" | "1Y">("6M")
  const { data, isLoading, error, refetch } = useOverview(range)

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Dashboard"
        subtitle={`All clients, properties, and reservations · ${today}`}
      >
        <ActionButton
          variant="outline"
          size="sm"
          toastMessage="Report queued"
          toastDescription="You'll get an email when the export is ready."
        >
          <Download className="size-4" />
          Export report
        </ActionButton>
      </AdminPageHeader>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} variant="page" />
      ) : isLoading || !data ? (
        <>
          <StatGridSkeleton count={8} />
          <CardListSkeleton count={2} />
        </>
      ) : (
        <>
          <StatGrid stats={data.stats} className="lg:grid-cols-4" />

          <div className="grid gap-4 xl:grid-cols-3">
            <SectionCard
              className="xl:col-span-2"
              title="Platform Revenue & Bookings"
              description={`Monthly overview — ${range === "6M" ? "last 6 months" : "last 12 months"}`}
              action={
                <Tabs
                  value={range}
                  onValueChange={(v) => setRange(v as "6M" | "1Y")}
                >
                  <TabsList>
                    <TabsTrigger value="6M">6M</TabsTrigger>
                    <TabsTrigger value="1Y">1Y</TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            >
              <BarChart
                data={data.series.map((point) => ({
                  label: point.label,
                  value: point.revenue,
                  secondary: point.bookings,
                }))}
                showLine
                legendPrimary="Revenue"
                legendSecondary="Bookings"
                formatTick={(n) => `$${Math.round(n / 1000)}k`}
              />
            </SectionCard>

            <SectionCard
              title="Recent Activity"
              action={
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href="/admin/audit">View all</Link>}
                />
              }
              contentClassName="px-0"
            >
              <ul className="divide-y">
                {data.activity.map((event) => (
                  <li key={event.id} className="px-6 py-3">
                    <p className="text-sm font-medium">{event.action}</p>
                    <p className="text-muted-foreground text-xs text-pretty">
                      {event.details}
                    </p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {event.targetName} ·{" "}
                      {formatRelativeTime(event.at.replace(" ", "T"))}
                    </p>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard
            title="Client Performance"
            description="Current month — across all tenants"
            action={
              <Button
                variant="ghost"
                size="sm"
                render={
                  <Link href="/admin/clients">
                    View all clients
                    <ArrowUpRight className="size-4" />
                  </Link>
                }
              />
            }
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {data.clients.map(({ client, properties }) => (
                <Link
                  key={client.id}
                  href={`/admin/clients/${client.id}`}
                  className={cn(
                    "hover:border-primary/40 focus-visible:ring-ring/50 block rounded-lg border p-4 transition-colors outline-none focus-visible:ring-3"
                  )}
                >
                  <p className="truncate text-sm font-medium">{client.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {properties} {properties === 1 ? "property" : "properties"} ·{" "}
                    {client.plan}
                  </p>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Occupancy</span>
                      <span className="font-medium tabular-nums">
                        {client.occupancy}%
                      </span>
                    </div>
                    <Progress
                      value={client.occupancy}
                      aria-label={`${client.name} occupancy`}
                    />
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Revenue:{" "}
                    <Money
                      value={client.monthlyRevenue}
                      className="text-foreground font-medium"
                    />
                  </p>
                </Link>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}

/** Kept alongside the view so the route-level `loading.tsx` matches it. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3.5 w-40" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-3.5 w-96" />
      </div>
      <StatGridSkeleton count={8} />
      <CardListSkeleton count={2} />
    </div>
  )
}
