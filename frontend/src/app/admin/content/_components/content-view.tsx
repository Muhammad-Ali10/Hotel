"use client"

import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import type { AdminContentRow } from "@/lib/admin/api/endpoints"
import { useContent } from "@/lib/admin/api/hooks"
import { AdminPageHeader, StatGrid, StatusPill } from "@/components/admin/shared"
import { CardListSkeleton, useDataTable } from "@/components/shared/data-table"
import { DataTablePagination } from "@/components/shared/data-table"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"

/**
 * Listing quality, worst first (rule #99).
 *
 * This screen used to moderate "descriptions" as if they were their own
 * entity, with a status of Approved / Pending Review / Flagged, an Approve
 * button, a Flag button and an editor for rewriting a partner's copy. None of
 * it exists:
 *
 *   - **there is no content status.** A description is part of the listing,
 *     and the listing's own review is the moderation. Approving a listing
 *     approves everything on it.
 *   - **the platform cannot rewrite a partner's description.** There is no
 *     endpoint, and there should not be: the platform decides whether copy is
 *     acceptable, the business decides what it says.
 *
 * What IS real is the score, and it is more useful than a flag ever was: every
 * listing rated out of 100 across seven weighted categories, each with the
 * specific thing to fix. A category that does not apply yet — no reviews to
 * have replied to — is excluded and the weights renormalise, so a new listing
 * is not marked down for time not yet passed.
 */

const BAND_TONE: Record<string, string> = {
  excellent: "text-emerald-700 dark:text-emerald-400",
  good: "text-amber-700 dark:text-amber-400",
  needs_work: "text-destructive",
}

const BAND_LABEL: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  needs_work: "Needs work",
}

export function ContentView() {
  const table = useDataTable({ limit: 10 })
  const { data, isLoading, isFetching, error, refetch } = useContent(table.query)

  const items = React.useMemo(() => data?.items ?? [], [data?.items])
  const counts = data?.counts ?? {}

  /*
   * Banded over the page, and labelled as such.
   *
   * The API scores the page it returns, not the whole catalogue — scoring
   * every listing on the platform to fill three tiles would be a full-table
   * walk on every keystroke. So the tiles say "on this page", which is true,
   * rather than implying a platform-wide figure that is not.
   */
  const banded = React.useMemo(() => {
    const out = { excellent: 0, good: 0, needs_work: 0 }
    for (const item of items) {
      if (item.score) out[item.score.band as keyof typeof out] += 1
    }
    return out
  }, [items])

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Listing Quality"
        subtitle="Every listing scored out of 100, worst first — with what to fix"
      />

      <StatGrid
        stats={[
          {
            label: "Live listings",
            value: isLoading ? "—" : String(counts.active ?? 0),
            icon: "FileText",
          },
          {
            label: "Needs work",
            value: isLoading ? "—" : String(banded.needs_work),
            caption: "on this page · below 60",
            icon: "AlertTriangle",
          },
          {
            label: "Good",
            value: isLoading ? "—" : String(banded.good),
            caption: "on this page",
            icon: "Clock",
          },
          {
            label: "Excellent",
            value: isLoading ? "—" : String(banded.excellent),
            caption: "on this page",
            icon: "CheckCircle2",
          },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-sm">
          Ordered worst first — the screen exists to find the pages that need work.
        </p>
        <Input
          type="search"
          value={table.state.search}
          onChange={(e) => table.setSearch(e.target.value)}
          placeholder="Search properties, cities…"
          aria-label="Search listings"
          className="sm:max-w-xs"
        />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} variant="page" />
      ) : isLoading ? (
        <CardListSkeleton count={3} />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              filtered={table.hasActiveFilters}
              onClearFilters={table.clearFilters}
              title="No listings match"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div
            className={cn(
              "space-y-4 transition-opacity",
              isFetching && "pointer-events-none opacity-60"
            )}
          >
            {items.map((item) => (
              <ListingScoreCard key={item.id} item={item} />
            ))}
          </div>

          <Card className="p-0">
            <DataTablePagination
              className="border-t-0"
              shown={items.length}
              limit={table.state.limit}
              depth={table.depth}
              hasMore={data?.nextCursor !== null}
              onNext={() => data?.nextCursor && table.next(data.nextCursor)}
              onBack={table.back}
              onLimitChange={table.setLimit}
            />
          </Card>
        </>
      )}
    </div>
  )
}

function ListingScoreCard({ item }: { item: AdminContentRow }) {
  const score = item.score

  /*
   * The categories worth acting on: applicable, and not already full marks.
   *
   * Listing all seven every time buries the two that matter under five that
   * say "nothing to do here".
   */
  const actionable = (score?.categories ?? [])
    .filter((c) => c.applicable && (c.score ?? 100) < 100)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
    .slice(0, 3)

  const notYet = (score?.categories ?? []).filter((c) => !c.applicable)

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/admin/properties/${item.id}`}
              className="hover:text-primary font-medium underline-offset-2 hover:underline"
            >
              {item.name}
            </Link>
            <p className="text-muted-foreground text-xs">
              {item.orgName ?? "Unassigned"} · {item.city}, {item.country} ·
              updated {formatDate(item.updatedAt)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {score ? (
              <div className="w-32">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-muted-foreground">
                    {BAND_LABEL[score.band] ?? score.band}
                  </span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      BAND_TONE[score.band]
                    )}
                  >
                    {score.total}/100
                  </span>
                </div>
                <Progress
                  value={score.total}
                  aria-label={`Listing score for ${item.name}`}
                  className="mt-1"
                />
              </div>
            ) : null}
            <StatusPill status={item.status} />
          </div>
        </div>

        {actionable.length > 0 ? (
          <ul className="space-y-1.5 border-t pt-3">
            {actionable.map((category) => (
              <li key={category.key} className="flex items-start gap-3 text-sm">
                <span className="text-muted-foreground w-32 shrink-0">
                  {category.name}
                  <span className="ml-1.5 tabular-nums">{category.score}</span>
                </span>
                <span className="text-muted-foreground text-pretty">
                  {category.tip}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground border-t pt-3 text-sm">
            Nothing to improve on the categories that apply.
          </p>
        )}

        {notYet.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground text-xs">
              Not counted yet:
            </span>
            {notYet.map((category) => (
              <Badge key={category.key} variant="outline">
                {category.name}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/admin/properties/${item.id}`}>Open listing</Link>}
          />
          {item.orgId ? (
            <Button
              variant="ghost"
              size="sm"
              render={<Link href={`/admin/clients/${item.orgId}`}>View client</Link>}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
