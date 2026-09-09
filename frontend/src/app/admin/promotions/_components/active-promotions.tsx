"use client"

import * as React from "react"
import { RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCurrency, formatDate } from "@/lib/format"
import { toISODate } from "@/lib/domain"
import type { PromotionDto } from "@/lib/api/endpoints"
import { usePromotions, useSweepPromotions } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import { SectionCard, StatGrid, StatusPill } from "@/components/admin/shared"
import { CardListSkeleton } from "@/components/shared/data-table"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Running", value: "active" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Draft", value: "draft" },
  { label: "Paused", value: "paused" },
  { label: "Ended", value: "ended" },
]

/** What the guest actually saves, in the unit the discount is stored in. */
function discountLabel(promotion: PromotionDto): string {
  if (promotion.discountType === "percent") return `${promotion.discountValue}% off`
  if (promotion.discountType === "amount") {
    return `${formatCurrency(promotion.discountValue)} off`
  }
  return `${promotion.discountValue} free ${promotion.discountValue === 1 ? "night" : "nights"}`
}

/**
 * How deep a discount is, on one comparable scale.
 *
 * A percentage and a fixed amount are not the same kind of number, so they
 * cannot be ranked against each other honestly — this only ranks WITHIN
 * percentages, and says so. A free night is left out entirely: whether it is
 * generous depends on the rate it is free from, which this list does not know.
 */
function depthBand(promotion: PromotionDto): "deep" | "moderate" | null {
  if (promotion.discountType !== "percent") return null
  if (promotion.discountValue >= 25) return "deep"
  if (promotion.discountValue >= 10) return "moderate"
  return null
}

const BAND_STYLES = {
  deep: {
    ring: "border-emerald-500/40 bg-emerald-500/5",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  moderate: {
    ring: "border-amber-500/40 bg-amber-500/5",
    text: "text-amber-700 dark:text-amber-400",
  },
} as const

export function ActivePromotions() {
  const can = useCan()
  const [status, setStatus] = React.useState("")

  const query = React.useMemo(
    () => ({ limit: 100, ...(status ? { status } : {}) }),
    [status]
  )

  const { data, isLoading, error, refetch } = usePromotions(query)
  const sweep = useSweepPromotions()

  const canSweep = can.manage("promotions")
  const today = toISODate(new Date())

  const promotions = React.useMemo(() => data ?? [], [data])

  /*
   * What the sweep would move, worked out the same way the server does.
   *
   * Shown so the button is not a mystery: a status is a fact about TODAY, and
   * nothing moves it on its own until a cron exists (rule #17).
   */
  const stale = React.useMemo(() => {
    let due = 0
    let expired = 0
    for (const promotion of promotions) {
      if (promotion.status === "scheduled" && promotion.startDate <= today) due += 1
      if (promotion.status === "active" && promotion.endDate < today) expired += 1
    }
    return { due, expired }
  }, [promotions, today])

  /** The deepest percentage discounts currently running, from this list. */
  const deepest = React.useMemo(
    () =>
      promotions
        .filter((p) => p.status === "active" && p.discountType === "percent")
        .sort((a, b) => b.discountValue - a.discountValue)
        .slice(0, 5),
    [promotions]
  )

  return (
    <div className="space-y-6">
      <StatGrid
        stats={[
          {
            label: "Running",
            value: isLoading
              ? "—"
              : String(promotions.filter((p) => p.status === "active").length),
            caption: "in this list",
            icon: "Tag",
          },
          {
            label: "Scheduled",
            value: isLoading
              ? "—"
              : String(promotions.filter((p) => p.status === "scheduled").length),
            icon: "Clock",
          },
          {
            label: "Due to start",
            value: isLoading ? "—" : String(stale.due),
            caption: "waiting on a sweep",
            icon: "PlayCircle",
          },
          {
            label: "Past their end date",
            value: isLoading ? "—" : String(stale.expired),
            caption: "still marked running",
            icon: "AlertTriangle",
          },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Promotion status"
          className="bg-muted flex flex-wrap gap-1 rounded-lg p-1"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => setStatus(tab.value)}
              className={cn(
                "focus-visible:ring-ring/50 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
                status === tab.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {canSweep ? (
          <Button
            variant="outline"
            size="sm"
            disabled={sweep.isPending}
            onClick={() => sweep.mutate(undefined)}
          >
            <RefreshCw className="size-4" />
            {sweep.isPending ? "Sweeping…" : "Start what is due, end what expired"}
          </Button>
        ) : null}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} variant="page" />
      ) : isLoading ? (
        <CardListSkeleton count={3} />
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="No promotions"
              description="Campaigns created by clients appear here."
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {deepest.length > 0 ? (
            <SectionCard
              title="Deepest discounts running"
              description="Percentages only — a fixed amount and a percentage are not comparable, and a free night depends on the rate it is free from."
            >
              <ul className="divide-y">
                {deepest.map((promotion) => (
                  <li
                    key={promotion.id}
                    className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="min-w-0 truncate text-sm">{promotion.name}</span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {promotion.discountValue}%
                    </span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {promotions.map((promotion) => {
              const band = depthBand(promotion)
              const styles = band ? BAND_STYLES[band] : null
              return (
                <Card
                  key={promotion.id}
                  className={cn(styles?.ring, styles ? "border" : undefined)}
                >
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="font-heading text-sm font-semibold">
                          {promotion.name}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <StatusPill status={promotion.status} />
                          <Badge variant="outline">{promotion.channel}</Badge>
                          <Badge variant="secondary">{promotion.kind}</Badge>
                        </div>
                      </div>
                      <p
                        className={cn(
                          "font-heading shrink-0 text-base font-semibold",
                          styles?.text
                        )}
                      >
                        {discountLabel(promotion)}
                      </p>
                    </div>

                    <p className="text-muted-foreground text-sm">
                      {formatDate(promotion.startDate)} –{" "}
                      {formatDate(promotion.endDate)} · {promotion.propertyIds.length}{" "}
                      {promotion.propertyIds.length === 1 ? "property" : "properties"} ·{" "}
                      {promotion.roomIds.length === 0
                        ? "every room"
                        : `${promotion.roomIds.length} rooms`}
                      {promotion.minStay ? ` · ${promotion.minStay}+ nights` : ""}
                    </p>

                    {promotion.status === "active" && promotion.endDate < today ? (
                      <p className="text-destructive text-xs">
                        Past its end date but still marked running — a sweep will
                        close it.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
