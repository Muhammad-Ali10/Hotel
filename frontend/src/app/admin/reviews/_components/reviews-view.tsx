"use client"

import * as React from "react"
import Link from "next/link"
import { Flag } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import type { ReviewDto } from "@/lib/api/endpoints"
import { useModerateReview, useReviews } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  AdminPageHeader,
  ConfirmDialog,
  InfoNote,
  StarRating,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import {
  CardListSkeleton,
  DataTablePagination,
  useDataTable,
} from "@/components/shared/data-table"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * The moderation queue (rules #40, #41).
 *
 * Two outcomes, because the API has two: **publish** or **reject**. The old
 * screen offered four — Publish, Hide, Flag and an implicit Pending — and two
 * of them were not decisions anybody can make:
 *
 *   - **"Hide"** was `reject` under a gentler name. Calling the same act two
 *     things is how a queue ends up with reviews nobody can account for.
 *   - **"Flag"** is not an admin action at all. A flag is what somebody else
 *     raises about a review; an admin flagging one would be queueing work for
 *     themselves.
 *
 * `withdrawn` is absent from the tabs for a sharper reason: it is the AUTHOR's
 * decision. An admin able to set it could take a review down while it reads as
 * the guest's own doing.
 *
 * Moderation is the platform's alone — a property that could hide its own bad
 * reviews would leave a rating nobody should trust.
 */

const TABS = [
  { label: "Waiting", value: "pending" },
  { label: "Flagged", value: "flagged" },
  { label: "Published", value: "published" },
  { label: "Rejected", value: "rejected" },
  { label: "Withdrawn", value: "withdrawn" },
]

export function ReviewsView() {
  const can = useCan()
  const [tab, setTab] = React.useState("pending")
  const table = useDataTable({ limit: 10 })
  const canModerate = can.do("review.moderate")

  const query = React.useMemo(
    () => ({ ...table.query, status: tab }),
    [table.query, tab]
  )

  const { data, isLoading, isFetching, error, refetch } = useReviews(query)
  const moderate = useModerateReview()

  const rows = data?.items ?? []
  const counts = data?.counts ?? {}
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Reviews Moderation"
        subtitle={
          isLoading ? "Loading…" : `${total} reviews across every property`
        }
      />

      <StatGrid
        stats={[
          {
            label: "Waiting on us",
            value: isLoading ? "—" : String(counts.pending ?? 0),
            icon: "Clock",
          },
          {
            label: "Flagged",
            value: isLoading ? "—" : String(counts.flagged ?? 0),
            caption: "reported by somebody",
            icon: "AlertTriangle",
          },
          {
            label: "Published",
            value: isLoading ? "—" : String(counts.published ?? 0),
            icon: "CheckCircle2",
          },
          {
            label: "Rejected",
            value: isLoading ? "—" : String(counts.rejected ?? 0),
            icon: "Ban",
          },
        ]}
      />

      <div
        role="tablist"
        aria-label="Review status"
        className="bg-muted flex flex-wrap gap-1 rounded-lg p-1"
      >
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={tab === option.value}
            onClick={() => setTab(option.value)}
            className={cn(
              "focus-visible:ring-ring/50 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
              tab === option.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
            <span className="text-muted-foreground ml-1.5 text-xs tabular-nums">
              {counts[option.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} variant="page" />
      ) : isLoading ? (
        <CardListSkeleton count={3} />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title={`Nothing ${TABS.find((t) => t.value === tab)?.label.toLowerCase()}`}
              description={
                tab === "pending"
                  ? "Every review has been looked at."
                  : undefined
              }
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
            {rows.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                canModerate={canModerate}
                isPending={moderate.isPending}
                onModerate={(status) => moderate.mutate({ id: review.id, status })}
              />
            ))}
          </div>

          <Card className="p-0">
            <DataTablePagination
              className="border-t-0"
              shown={rows.length}
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

      <InfoNote>
        Only the platform moderates reviews. A property that could hide its own
        bad ones would leave a rating nobody should trust — and a review the
        guest themselves withdrew is their decision, not ours to reverse.
      </InfoNote>
    </div>
  )
}

function ReviewCard({
  review,
  canModerate,
  isPending,
  onModerate,
}: {
  review: ReviewDto
  canModerate: boolean
  isPending: boolean
  onModerate: (status: "published" | "rejected") => void
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{review.author}</span>
              <StarRating value={review.rating} />
              <StatusPill status={review.status} />
              {review.verified ? (
                /* The reviewer demonstrably stayed — that is what the badge is. */
                <span className="text-muted-foreground text-xs">Verified stay</span>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              <Link
                href={`/admin/properties/${review.propertyId}`}
                className="hover:text-foreground underline-offset-2 hover:underline"
              >
                {review.propertyName ?? review.propertyId}
              </Link>
              {review.roomName ? ` · ${review.roomName}` : null} ·{" "}
              {formatDate(review.createdAt)}
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="font-heading text-sm font-semibold">{review.title}</p>
          <p className="text-muted-foreground text-sm text-pretty">{review.body}</p>
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
              The property replied
            </p>
            <p className="text-sm text-pretty">{review.response.text}</p>
          </div>
        ) : null}

        {canModerate && review.status !== "withdrawn" ? (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {review.status !== "published" ? (
              <ConfirmDialog
                trigger={
                  <Button variant="outline" size="sm" disabled={isPending}>
                    Publish
                  </Button>
                }
                title="Publish this review?"
                description="It becomes visible on the property's page and counts toward its rating."
                confirmLabel="Publish"
                onConfirm={() => onModerate("published")}
              />
            ) : null}
            {review.status !== "rejected" ? (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" disabled={isPending}>
                    Reject
                  </Button>
                }
                title="Reject this review?"
                description="It stays on record but never appears publicly and does not count toward the rating."
                confirmLabel="Reject"
                destructive
                onConfirm={() => onModerate("rejected")}
              />
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
