"use client"

import * as React from "react"
import Link from "next/link"

import type { AdminPropertyRow } from "@stayora/shared"
import { useProperties } from "@/lib/admin/api/hooks"
import { formatCurrency } from "@/lib/format"
import {
  AdminPageHeader,
  CellStack,
  InfoNote,
  StarRating,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/**
 * The master property list.
 *
 * Every verdict happens on the property's own page, not from a row here, and
 * that is deliberate. The API has two decisions and both carry weight:
 * `decision` (approve / request changes / reject) and `suspension`. Neither is
 * a thing to do to six checkboxes at once — "request changes" needs a note
 * saying WHAT to change, and a note written once for six different properties
 * is a note about none of them.
 *
 * So the old inline Approve and Suspend buttons, and the bulk versions of
 * both, are gone. Review opens the listing, where the gaps, the photos and the
 * pending edits are visible — which is the only place a verdict can honestly
 * be formed.
 */
const STATUS_FACETS = [
  { label: "Live", value: "active" },
  { label: "Waiting on us", value: "pending_review" },
  { label: "Changes requested", value: "changes_requested" },
  { label: "Suspended", value: "suspended" },
  { label: "Rejected", value: "rejected" },
  { label: "Draft", value: "draft" },
]

export function PropertiesView() {
  const table = useDataTable()
  const { data, isLoading, isFetching, error, refetch } = useProperties(table.query)

  const counts = React.useMemo(() => data?.counts ?? {}, [data?.counts])
  const total = React.useMemo(
    () => Object.values(counts).reduce((sum, n) => sum + n, 0),
    [counts]
  )

  const columns: Column<AdminPropertyRow>[] = [
    {
      id: "name",
      header: "Property",
      cell: (property) => (
        <CellStack
          primary={property.name}
          secondary={`${property.city}, ${property.country}`}
          href={`/admin/properties/${property.id}`}
        />
      ),
    },
    {
      id: "client",
      header: "Client",
      hideBelow: "lg",
      cell: (property) =>
        property.orgId ? (
          <Link
            href={`/admin/clients/${property.orgId}`}
            className="hover:text-primary underline-offset-2 hover:underline"
          >
            {property.orgName}
          </Link>
        ) : (
          /*
           * A property with no organisation is one the platform created
           * directly, before anybody was attached to it. Rare, and worth
           * seeing rather than rendering as a blank cell.
           */
          <span className="text-muted-foreground text-sm">unassigned</span>
        ),
    },
    {
      id: "stars",
      header: "Rating",
      hideBelow: "xl",
      cell: (property) =>
        property.stars === null ? (
          <span className="text-muted-foreground text-sm">unrated</span>
        ) : (
          <StarRating value={property.stars} showValue={false} />
        ),
    },
    {
      id: "rooms",
      header: "Rooms",
      align: "right",
      hideBelow: "md",
      cell: (property) => <span className="tabular-nums">{property.rooms}</span>,
    },
    {
      id: "photos",
      header: "Photos",
      align: "right",
      hideBelow: "xl",
      cell: (property) => (
        <span
          className={
            // Five is the publish minimum (rule #70) — below it, worth flagging.
            property.photos < 5 ? "text-destructive tabular-nums" : "tabular-nums"
          }
        >
          {property.photos}
        </span>
      ),
    },
    {
      id: "fromPrice",
      header: "From",
      align: "right",
      hideBelow: "lg",
      cell: (property) => (
        <span className="tabular-nums">
          {property.fromPrice === 0 ? "—" : formatCurrency(property.fromPrice)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (property) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill status={property.status} />
          {property.hasPendingChanges ? (
            /* A live listing whose partner has edited it (rule #71). */
            <Badge variant="outline">edit waiting</Badge>
          ) : null}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (property) => (
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/admin/properties/${property.id}`}>Review</Link>}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Properties"
        subtitle={
          isLoading ? "Loading…" : `${total} properties across the marketplace`
        }
      />

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        nextCursor={data?.nextCursor ?? null}
        getRowId={(property) => property.id}
        table={table}
        caption="Every property with its client, size, photo count and review status"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        rowHref={(property) => `/admin/properties/${property.id}`}
        searchPlaceholder="Search properties, cities…"
        emptyTitle="No properties"
        emptyDescription="Properties appear here once a registration is approved."
        facets={[
          {
            id: "status",
            label: "Status",
            options: STATUS_FACETS.map((facet) => ({
              ...facet,
              count: counts[facet.value],
            })),
          },
        ]}
      >
        <StatGrid
          stats={[
            {
              label: "Live",
              value: isLoading ? "—" : String(counts.active ?? 0),
              icon: "CheckCircle2",
            },
            {
              label: "Waiting on us",
              value: isLoading ? "—" : String(counts.pending_review ?? 0),
              caption: "submitted, not decided",
              icon: "Clock",
            },
            {
              label: "Changes requested",
              value: isLoading ? "—" : String(counts.changes_requested ?? 0),
              caption: "back with the partner",
              icon: "FileText",
            },
            {
              label: "Suspended",
              value: isLoading ? "—" : String(counts.suspended ?? 0),
              icon: "Ban",
            },
          ]}
        />
      </DataTable>

      <InfoNote>
        Approving, requesting changes and suspending all happen on the property
        page, where the photos, the gaps and any waiting edit can be seen. Each
        needs a reason, and each is recorded in the audit log.
      </InfoNote>
    </div>
  )
}
