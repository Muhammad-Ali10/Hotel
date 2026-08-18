"use client"

import * as React from "react"
import Link from "next/link"
import { Flag } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import type { Review, ReviewStatus } from "@/lib/admin/types"
import type { ListParams } from "@/lib/admin/api/transport"
import { adminReviews, clientName, propertyById, propertyName } from "@/data/admin"
import {
  useAdminCounts,
  useReviews,
  useSetReviewStatus,
} from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  AdminPageHeader,
  ConfirmDialog,
  StarRating,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import { useDataTable } from "@/components/shared/data-table"
import { CardListSkeleton } from "@/components/shared/data-table"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DataTablePagination } from "@/components/shared/data-table"
import { Input } from "@/components/ui/input"

const TABS: (ReviewStatus | "All")[] = [
  "All",
  "Published",
  "Flagged",
  "Pending Review",
  "Hidden",
]

/**
 * Card-based moderation queue. Unlike the Figma this paginates (it rendered all
 * eight reviews with no controls) and shows the real star rating rather than a
 * fixed ★★★★★.
 */
export function ReviewsView() {
  const can = useCan()
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("All")
  const table = useDataTable({ sortBy: "date", sortDir: "desc", pageSize: 5 })
  const canModerate = can.do("review.moderate")

  const params = React.useMemo<ListParams>(() => {
    const filters: Record<string, string[]> =
      tab === "All" ? {} : { status: [tab] }
    return { ...table.params, filters }
  }, [table.params, tab])

  const { data, isLoading, error, refetch } = useReviews(params)
  const setStatus = useSetReviewStatus()

  // Live counts, so moderating a review moves the tab and tile numbers.
  const { data: live } = useAdminCounts()
  const counts = TABS.reduce<Record<string, number>>((acc, status) => {
    if (status === "All") {
      acc[status] = live?.totals.reviews ?? adminReviews.length
    } else {
      acc[status] =
        live?.reviews[status] ??
        adminReviews.filter((r) => r.status === status).length
    }
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reviews Moderation"
        subtitle={`${counts.All} reviews across all properties`}
      />

      <StatGrid
        stats={[
          { label: "Total Reviews", value: String(counts.All), icon: "Star" },
          {
            label: "Published",
            value: String(counts.Published),
            icon: "CheckCircle2",
          },
          { label: "Flagged", value: String(counts.Flagged), icon: "AlertTriangle" },
          {
            label: "Pending Review",
            value: String(counts["Pending Review"]),
            icon: "Clock",
          },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Review status"
          className="bg-muted flex flex-wrap gap-1 rounded-lg p-1"
        >
          {TABS.map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={tab === status}
              onClick={() => {
                setTab(status)
                table.setPage(1)
              }}
              className={cn(
                "focus-visible:ring-ring/50 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
                tab === status
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {status}
              <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">
                {counts[status]}
              </span>
            </button>
          ))}
        </div>

        <Input
          type="search"
          value={table.state.search}
          onChange={(e) => table.setSearch(e.target.value)}
          placeholder="Search reviews, guests, properties…"
          aria-label="Search reviews"
          className="sm:max-w-xs"
        />
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} variant="page" />
      ) : isLoading ? (
        <CardListSkeleton count={3} />
      ) : (data?.rows.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              filtered={Boolean(table.state.search) || tab !== "All"}
              onClearFilters={() => {
                table.clearFilters()
                setTab("All")
              }}
              title={
                tab === "Hidden"
                  ? "No hidden reviews"
                  : "No reviews in this state"
              }
              description={
                tab === "Hidden"
                  ? "Reviews you hide from the marketplace will collect here."
                  : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {data!.rows.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                canModerate={canModerate}
                isPending={setStatus.isPending}
                onModerate={(status) =>
                  setStatus.mutate({ id: review.id, status })
                }
              />
            ))}
          </div>

          <Card className="p-0">
            <DataTablePagination
              className="border-t-0"
              page={table.state.page}
              pageSize={table.state.pageSize}
              total={data!.total}
              onPageChange={table.setPage}
              onPageSizeChange={table.setPageSize}
            />
          </Card>
        </>
      )}
    </div>
  )
}

function ReviewCard({
  review,
  canModerate,
  isPending,
  onModerate,
}: {
  review: Review
  canModerate: boolean
  isPending: boolean
  onModerate: (status: ReviewStatus) => void
}) {
  const property = propertyById(review.propertyId)

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{review.guestName}</span>
              <StarRating value={review.rating} />
              <StatusPill status={review.status} />
            </div>
            <p className="text-muted-foreground text-xs">
              <Link
                href={`/admin/properties/${review.propertyId}`}
                className="hover:text-foreground underline-offset-2 hover:underline"
              >
                {propertyName(review.propertyId)}
              </Link>
              {property ? ` · ${clientName(property.clientId)}` : null} ·{" "}
              {formatDate(review.date)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="font-heading text-sm font-semibold">{review.title}</p>
          <p className="text-muted-foreground text-sm text-pretty">
            {review.body}
          </p>
        </div>

        {review.flagReason ? (
          <p className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg px-3 py-2 text-xs">
            <Flag aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="text-pretty">{review.flagReason}</span>
          </p>
        ) : null}

        {review.response ? (
          <div className="bg-muted rounded-lg px-3 py-2">
            <p className="text-muted-foreground text-xs font-medium">
              Owner response
            </p>
            <p className="text-sm text-pretty">{review.response}</p>
          </div>
        ) : null}

        {canModerate ? (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {review.status !== "Published" ? (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" disabled={isPending}>
                    Publish
                  </Button>
                }
                title="Publish this review?"
                description="The review becomes visible on the property's marketplace page."
                confirmLabel="Publish"
                onConfirm={() => onModerate("Published")}
              />
            ) : null}
            {review.status !== "Hidden" ? (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" disabled={isPending}>
                    Hide
                  </Button>
                }
                title="Hide this review?"
                description="The review is removed from the marketplace but kept on record."
                confirmLabel="Hide"
                destructive
                onConfirm={() => onModerate("Hidden")}
              />
            ) : null}
            {review.status !== "Flagged" ? (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" disabled={isPending}>
                    Flag
                  </Button>
                }
                title="Flag this review?"
                description="Flagging queues the review for a second opinion before it is published."
                confirmLabel="Flag"
                onConfirm={() => onModerate("Flagged")}
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
