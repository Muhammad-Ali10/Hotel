"use client"

import type { AuditCategory, AuditEvent } from "@/lib/admin/types"
import { adminAuditEvents } from "@/data/admin"
import { useAuditEvents } from "@/lib/admin/api/hooks"
import { AdminPageHeader, CellStack, InfoNote } from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"

const CATEGORIES: AuditCategory[] = [
  "User",
  "Property",
  "Billing",
  "Content",
  "Security",
  "System",
]

/**
 * The immutable action trail. Unlike the Figma this paginates and is
 * searchable — it rendered all twelve events with no controls.
 */
export function AuditView() {
  const table = useDataTable({ sortBy: "at", sortDir: "desc", pageSize: 25 })
  const { data, isLoading, isFetching, error, refetch } = useAuditEvents(
    table.params
  )

  const columns: Column<AuditEvent>[] = [
    {
      id: "action",
      header: "Action",
      sortable: true,
      cell: (event) => <span className="font-medium">{event.action}</span>,
    },
    {
      id: "actorName",
      header: "Actor",
      sortable: true,
      cell: (event) => (
        <CellStack primary={event.actorName} secondary={event.actorRole} />
      ),
    },
    {
      id: "targetName",
      header: "Target",
      sortable: true,
      hideBelow: "md",
      cell: (event) => (
        <CellStack primary={event.targetName} secondary={event.targetKind} />
      ),
    },
    {
      id: "details",
      header: "Details",
      hideBelow: "lg",
      className: "max-w-96",
      cell: (event) => (
        <span className="text-muted-foreground block truncate text-xs">
          {event.details}
        </span>
      ),
    },
    {
      id: "category",
      header: "Category",
      sortable: true,
      cell: (event) => <Badge variant="outline">{event.category}</Badge>,
    },
    {
      id: "at",
      header: "Timestamp",
      sortable: true,
      cell: (event) => (
        <span className="text-muted-foreground tabular-nums">{event.at}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Activity & Audit Log"
        subtitle="Complete record of every action taken on the platform"
      />

      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        total={data?.total ?? 0}
        getRowId={(event) => event.id}
        table={table}
        caption="Audit trail of platform actions with actor, target and category"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        searchPlaceholder="Search actions, actors, targets…"
        emptyTitle="No activity"
        emptyDescription="Platform actions are recorded here as they happen."
        facets={[
          {
            id: "category",
            label: "Category",
            options: CATEGORIES.map((category) => ({
              label: category,
              value: category,
              count: adminAuditEvents.filter((e) => e.category === category)
                .length,
            })),
          },
        ]}
      />

      <InfoNote>
        Every action on the platform is logged permanently. Actions you take in
        this session — approvals, suspensions, invoices — appear at the top of
        this list.
      </InfoNote>
    </div>
  )
}
