"use client"

import type { AuditLineView } from "@stayora/shared"

import { formatRelativeTime } from "@/lib/format"
import { useAuditEvents } from "@/lib/admin/api/hooks"
import { AdminPageHeader, CellStack, InfoNote } from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"

/**
 * Who did what, and why they said they did it.
 *
 * Append-only by construction. Every consequential action the platform takes
 * writes a line here with the reason its operator typed — a suspension nobody
 * can explain six months later is indefensible, and this is the screen where
 * that explanation lives.
 *
 * The subject types are the API's own enum. The mock had six invented
 * categories — "Billing", "Security", "System" — that nothing writes, so
 * filtering by them would have returned nothing forever.
 *
 * `metadata` carries the before-and-after of whatever changed. It is rendered
 * as-is rather than prettified per action: a log that reformats its own
 * contents is a log that can be wrong about them.
 */
const SUBJECT_TYPES = [
  { label: "Bookings", value: "booking" },
  { label: "Accounts", value: "user" },
  { label: "Properties", value: "property" },
  { label: "Clients", value: "partner_org" },
  { label: "Payouts", value: "payout" },
  { label: "Reviews", value: "review" },
  { label: "Promotions", value: "promotion" },
]

export function AuditView() {
  const table = useDataTable({ limit: 25 })
  const { data, isLoading, isFetching, error, refetch } = useAuditEvents(table.query)

  const columns: Column<AuditLineView>[] = [
    {
      id: "action",
      header: "Action",
      cell: (line) => <span className="font-medium">{line.action}</span>,
    },
    {
      id: "actor",
      header: "Who",
      cell: (line) => (
        <CellStack
          primary={line.actorEmail || "system"}
          /*
           * A line with no actor is the system acting on its own — a hold
           * lapsing, a scheduled job. Saying so beats an empty cell that
           * reads like missing data.
           */
          secondary={line.actorId ? undefined : "automatic"}
        />
      ),
    },
    {
      id: "subject",
      header: "On what",
      hideBelow: "md",
      cell: (line) => (
        <div className="space-y-1">
          <Badge variant="secondary">{line.subjectType}</Badge>
          {line.subjectId ? (
            <p className="text-muted-foreground truncate font-mono text-xs">
              {line.subjectId.slice(0, 8)}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "reason",
      header: "Why",
      hideBelow: "lg",
      className: "max-w-96",
      cell: (line) => (
        <span className="text-muted-foreground block text-xs text-pretty">
          {line.reason || "—"}
        </span>
      ),
    },
    {
      id: "metadata",
      header: "What changed",
      hideBelow: "xl",
      className: "max-w-72",
      cell: (line) =>
        line.metadata ? (
          <span className="text-muted-foreground block truncate font-mono text-xs">
            {JSON.stringify(line.metadata)}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
    {
      id: "createdAt",
      header: "When",
      align: "right",
      cell: (line) => (
        <span className="text-muted-foreground text-sm">
          {formatRelativeTime(line.createdAt)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Audit Log"
        subtitle="Every consequential action, with the reason its operator gave"
      />

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        nextCursor={data?.nextCursor ?? null}
        getRowId={(line) => line.id}
        table={table}
        caption="Audit lines with the action, who took it, what it was about and why"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        emptyTitle="Nothing logged yet"
        emptyDescription="Suspensions, refunds, listing decisions and rate changes all appear here."
        facets={[
          { id: "subjectType", label: "On what", options: SUBJECT_TYPES },
        ]}
      />

      <InfoNote>
        This log is append-only. Nothing in the product edits or deletes a line,
        which is the whole point: a record that can be tidied afterwards cannot
        answer the question it exists for.
      </InfoNote>
    </div>
  )
}
