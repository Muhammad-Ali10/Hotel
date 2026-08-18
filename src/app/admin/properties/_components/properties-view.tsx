"use client"

import * as React from "react"
import Link from "next/link"
import { CheckCircle2, Download, PauseCircle } from "lucide-react"

import type { Property, PropertyStatus } from "@/lib/admin/types"
import { adminClients, adminProperties, clientName } from "@/data/admin"
import {
  useAdminCounts,
  useProperties,
  useTransitionProperty,
} from "@/lib/admin/api/hooks"
import { allowedTransitions } from "@/lib/admin/api/endpoints"
import { useCan } from "@/components/admin/role-provider"
import {
  ActionButton,
  AdminPageHeader,
  CellStack,
  ConfirmDialog,
  InfoNote,
  Money,
  StarRating,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import {
  DataTable,
  useDataTable,
  type BulkAction,
  type Column,
} from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"

const STATUSES: PropertyStatus[] = [
  "Active",
  "Pending",
  "Changes Requested",
  "Rejected",
  "Suspended",
  "Draft",
]

/** The master property list — every extranet property page derives from here. */
export function PropertiesView() {
  const can = useCan()
  const table = useDataTable({ sortBy: "name" })
  const { data, isLoading, isFetching, error, refetch } = useProperties(
    table.params
  )
  const transition = useTransitionProperty()
  const canApprove = can.do("property.approve")
  const canSuspend = can.do("property.suspend")

  const columns: Column<Property>[] = [
    {
      id: "name",
      header: "Property",
      sortable: true,
      cell: (property) => (
        <CellStack
          primary={property.name}
          secondary={property.id}
          href={`/admin/properties/${property.id}`}
        />
      ),
    },
    {
      id: "client",
      header: "Client",
      sortable: true,
      hideBelow: "lg",
      cell: (property) => (
        <Link
          href={`/admin/clients/${property.clientId}`}
          className="hover:text-primary underline-offset-2 hover:underline"
        >
          {clientName(property.clientId)}
        </Link>
      ),
    },
    {
      id: "location",
      header: "Location",
      sortable: true,
      hideBelow: "md",
      cell: (property) => (
        <span className="text-muted-foreground">
          {property.city}, {property.country}
        </span>
      ),
    },
    {
      id: "stars",
      header: "Rating",
      sortable: true,
      hideBelow: "xl",
      cell: (property) => (
        <StarRating value={property.stars} showValue={false} />
      ),
    },
    {
      id: "rooms",
      header: "Rooms",
      sortable: true,
      align: "right",
      hideBelow: "md",
      cell: (property) => <span className="tabular-nums">{property.rooms}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (property) => <StatusPill status={property.status} />,
    },
    {
      id: "occupancy",
      header: "Occupancy",
      sortable: true,
      align: "right",
      hideBelow: "lg",
      cell: (property) => (
        <span className="tabular-nums">{property.occupancy}%</span>
      ),
    },
    {
      id: "adr",
      header: "ADR",
      sortable: true,
      align: "right",
      cell: (property) => <Money value={property.adr} />,
    },
    {
      id: "revenueToday",
      header: "Revenue",
      sortable: true,
      align: "right",
      hideBelow: "xl",
      cell: (property) => <Money value={property.revenueToday} />,
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (property) => {
        const next = allowedTransitions(property.status)
        return (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="sm"
              render={
                <Link href={`/admin/properties/${property.id}`}>Review</Link>
              }
            />
            {next.includes("Active") && canApprove ? (
              <ConfirmDialog
                trigger={<Button variant="ghost" size="sm">Approve</Button>}
                title={`Approve ${property.name}?`}
                description="The property becomes visible on the marketplace and starts accepting bookings."
                confirmLabel="Approve"
                onConfirm={() =>
                  transition.mutate({ id: property.id, next: "Active" })
                }
              />
            ) : null}
            {next.includes("Suspended") && canSuspend ? (
              <ConfirmDialog
                trigger={<Button variant="ghost" size="sm">Suspend</Button>}
                title={`Suspend ${property.name}?`}
                description="The property is hidden from search and cannot take new bookings. Existing reservations are unaffected."
                confirmLabel="Suspend"
                destructive
                onConfirm={() =>
                  transition.mutate({ id: property.id, next: "Suspended" })
                }
              />
            ) : null}
          </div>
        )
      },
    },
  ]

  const bulkActions: BulkAction<Property>[] = [
    {
      id: "approve",
      label: "Approve",
      icon: CheckCircle2,
      hidden: !canApprove,
      onRun: (_ids, rows) => {
        const eligible = rows.filter((p) =>
          allowedTransitions(p.status).includes("Active")
        )
        eligible.forEach((p) => transition.mutate({ id: p.id, next: "Active" }))
        table.clearSelection()
      },
    },
    {
      id: "suspend",
      label: "Suspend",
      icon: PauseCircle,
      destructive: true,
      hidden: !canSuspend,
      onRun: (_ids, rows) => {
        const eligible = rows.filter((p) =>
          allowedTransitions(p.status).includes("Suspended")
        )
        eligible.forEach((p) =>
          transition.mutate({ id: p.id, next: "Suspended" })
        )
        table.clearSelection()
      },
    },
  ]

  // Live counts, so approving or suspending updates the tiles and facet badges.
  const { data: live } = useAdminCounts()
  const counts = React.useMemo(() => {
    if (live) return live.properties
    return STATUSES.reduce<Record<string, number>>((acc, status) => {
      acc[status] = adminProperties.filter((p) => p.status === status).length
      return acc
    }, {})
  }, [live])
  const totalProperties = live?.totals.properties ?? adminProperties.length
  const perClient = live?.propertiesPerClient

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Properties"
        subtitle={`Master source — ${totalProperties} properties across ${adminClients.length} clients`}
      >
        <ActionButton
          variant="outline"
          size="sm"
          toastMessage="Export started"
          toastDescription="A CSV of all properties will download shortly."
        >
          <Download className="size-4" />
          Export
        </ActionButton>
      </AdminPageHeader>

      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        total={data?.total ?? 0}
        getRowId={(property) => property.id}
        table={table}
        caption="Every property on the platform with its client, status and performance"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        rowHref={(property) => `/admin/properties/${property.id}`}
        searchPlaceholder="Search properties, clients, cities…"
        bulkActions={bulkActions}
        emptyTitle="No properties yet"
        emptyDescription="Properties appear here once a client submits them for review."
        facets={[
          {
            id: "status",
            label: "Status",
            options: STATUSES.map((status) => ({
              label: status,
              value: status,
              count: counts[status] ?? 0,
            })),
          },
          {
            id: "client",
            label: "Client",
            options: adminClients.map((client) => ({
              label: client.name,
              value: client.name,
              count:
                perClient?.[client.name] ??
                adminProperties.filter((p) => p.clientId === client.id).length,
            })),
          },
        ]}
      >
        <StatGrid
          stats={[
            {
              label: "Total Properties",
              value: String(totalProperties),
              icon: "Hotel",
            },
            {
              label: "Active",
              value: String(counts.Active ?? 0),
              icon: "CheckCircle2",
            },
            {
              label: "Pending Approval",
              value: String(counts.Pending ?? 0),
              icon: "Clock",
            },
            {
              label: "Suspended",
              value: String(counts.Suspended ?? 0),
              icon: "AlertTriangle",
            },
          ]}
        />
      </DataTable>

      <InfoNote>
        Master source for every property extranet page. Each property appears in
        its assigned client&rsquo;s extranet once approved.
      </InfoNote>
    </div>
  )
}
