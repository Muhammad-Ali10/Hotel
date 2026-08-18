"use client"

import * as React from "react"
import Link from "next/link"
import { Flag } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import type { ContentItem, ContentStatus } from "@/lib/admin/types"
import { adminContent, clientName, propertyById, propertyName } from "@/data/admin"
import {
  useAdminCounts,
  useContent,
  useSetContentStatus,
  useUpdateContent,
} from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  AdminPageHeader,
  ConfirmDialog,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import {
  CardListSkeleton,
  DataTablePagination,
  useDataTable,
} from "@/components/shared/data-table"
import { EmptyState, ErrorState } from "@/components/shared/states"
import type { ListParams } from "@/lib/admin/api/transport"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"

const TABS: (ContentStatus | "All")[] = [
  "All",
  "Approved",
  "Pending Review",
  "Flagged",
]

/** Score bands drive the meter colour — 60 is the publication threshold. */
function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-700 dark:text-emerald-400"
  if (score >= 60) return "text-amber-700 dark:text-amber-400"
  return "text-destructive"
}

export function ContentView() {
  const can = useCan()
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("All")
  const [editing, setEditing] = React.useState<ContentItem | null>(null)
  const table = useDataTable({ sortBy: "score", sortDir: "asc", pageSize: 5 })
  const canApprove = can.do("content.approve")

  const params = React.useMemo<ListParams>(() => {
    const filters: Record<string, string[]> =
      tab === "All" ? {} : { status: [tab] }
    return { ...table.params, filters }
  }, [table.params, tab])

  const { data, isLoading, error, refetch } = useContent(params)
  const setStatus = useSetContentStatus()

  // Live counts, so approving or flagging moves the tab and tile numbers.
  const { data: live } = useAdminCounts()
  const counts = TABS.reduce<Record<string, number>>((acc, status) => {
    if (status === "All") {
      acc[status] = live?.totals.content ?? adminContent.length
    } else {
      acc[status] =
        live?.content[status] ??
        adminContent.filter((c) => c.status === status).length
    }
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Content & Descriptions"
        subtitle="Review and approve property descriptions across all clients"
      />

      <StatGrid
        stats={[
          {
            label: "Total Descriptions",
            value: String(counts.All),
            icon: "FileText",
          },
          {
            label: "Approved",
            value: String(counts.Approved),
            icon: "CheckCircle2",
          },
          {
            label: "Pending Review",
            value: String(counts["Pending Review"]),
            icon: "Clock",
          },
          { label: "Flagged", value: String(counts.Flagged), icon: "AlertTriangle" },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Description status"
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
          placeholder="Search descriptions…"
          aria-label="Search descriptions"
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
              title="No descriptions in this state"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {data!.rows.map((item) => {
              const property = propertyById(item.propertyId)
              return (
                <Card key={item.id}>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/admin/properties/${item.propertyId}`}
                          className="hover:text-primary font-medium underline-offset-2 hover:underline"
                        >
                          {propertyName(item.propertyId)}
                        </Link>
                        <p className="text-muted-foreground text-xs">
                          {property ? clientName(property.clientId) : "—"} ·{" "}
                          {item.propertyId} · updated {formatDate(item.updatedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <div className="w-28">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="text-muted-foreground">Score</span>
                            <span
                              className={cn(
                                "font-medium tabular-nums",
                                scoreTone(item.score)
                              )}
                            >
                              {item.score}/100
                            </span>
                          </div>
                          <Progress
                            value={item.score}
                            aria-label={`Content score for ${propertyName(item.propertyId)}`}
                            className="mt-1"
                          />
                        </div>
                        <StatusPill status={item.status} />
                      </div>
                    </div>

                    <p className="text-muted-foreground text-sm text-pretty">
                      {item.body}
                    </p>

                    {item.flagReason ? (
                      <p className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-lg px-3 py-2 text-xs">
                        <Flag aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                        <span className="text-pretty">{item.flagReason}</span>
                      </p>
                    ) : null}

                    {canApprove ? (
                      <div className="flex flex-wrap gap-2 border-t pt-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing(item)}
                        >
                          Edit
                        </Button>
                        {item.status !== "Approved" ? (
                          <ConfirmDialog
                            trigger={
                              <Button variant="outline" size="sm">
                                Approve
                              </Button>
                            }
                            title="Approve this description?"
                            description="It goes live on the property's marketplace page."
                            confirmLabel="Approve"
                            onConfirm={() =>
                              setStatus.mutate({
                                id: item.id,
                                status: "Approved",
                              })
                            }
                          />
                        ) : null}
                        {item.status !== "Flagged" ? (
                          <ConfirmDialog
                            trigger={
                              <Button variant="ghost" size="sm">
                                Flag
                              </Button>
                            }
                            title="Flag this description?"
                            description="The client is asked to revise it before it can be published."
                            confirmLabel="Flag"
                            destructive
                            onConfirm={() =>
                              setStatus.mutate({
                                id: item.id,
                                status: "Flagged",
                                reason:
                                  "Flagged by an admin during content review.",
                              })
                            }
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
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

      {/* Keyed + conditionally rendered so the textarea seeds from the item
          on mount instead of syncing in an effect. */}
      {editing ? (
        <EditDescriptionDialog
          key={editing.id}
          item={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  )
}

function EditDescriptionDialog({
  item,
  onClose,
}: {
  item: ContentItem
  onClose: () => void
}) {
  const update = useUpdateContent()
  const [body, setBody] = React.useState(item.body)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit description</DialogTitle>
          <DialogDescription>
            {propertyName(item.propertyId)} — saving returns the description to
            Pending Review.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            aria-label="Property description"
          />
          <p className="text-muted-foreground text-xs">
            {body.trim().split(/\s+/).filter(Boolean).length} words
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={update.isPending || body.trim().length < 20}
            onClick={() =>
              update.mutate({ id: item.id, body: body.trim() }, { onSuccess: onClose })
            }
          >
            {update.isPending ? "Saving…" : "Save description"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
