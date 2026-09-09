"use client"

import * as React from "react"
import Link from "next/link"

import type { AdminOrg } from "@/lib/admin/api/endpoints"
import { useClients } from "@/lib/admin/api/hooks"
import {
  AdminPageHeader,
  CellStack,
  InfoNote,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/**
 * Tenant organisations — the "Client" every other screen links to.
 *
 * This screen does not exist in the Figma: its sidebar's "Clients" item opened
 * a list of individual travellers while Billing, Finance, Analytics and
 * Properties all referenced tenant orgs that had no page. Phase 1 decision D3
 * split the two; travellers live at `/admin/guests`.
 *
 * `GET /admin/partner-orgs` returns every organisation in one response — there
 * are tens of them, not thousands — so this table filters what it has rather
 * than asking the server. That is honest here and nowhere else in the panel:
 * it is the one admin list that is not paged, and it says so.
 */
export function ClientsView() {
  const table = useDataTable()
  const { data, isLoading, isFetching, error, refetch } = useClients()

  const all = React.useMemo(() => data ?? [], [data])

  const rows = React.useMemo(() => {
    const term = table.state.search.trim().toLowerCase()
    const status = table.state.filters.status
    return all.filter((org) => {
      if (status && org.status !== status) return false
      if (!term) return true
      return [org.name, org.contactEmail, org.country].some((field) =>
        field.toLowerCase().includes(term)
      )
    })
  }, [all, table.state.search, table.state.filters.status])

  const columns: Column<AdminOrg>[] = [
    {
      id: "name",
      header: "Client",
      cell: (org) => (
        <CellStack
          primary={org.name}
          secondary={org.contactEmail}
          href={`/admin/clients/${org.id}`}
        />
      ),
    },
    {
      id: "contactPhone",
      header: "Phone",
      hideBelow: "lg",
      cell: (org) => org.contactPhone || "—",
    },
    {
      id: "country",
      header: "Country",
      hideBelow: "xl",
      cell: (org) => org.country || "—",
    },
    {
      id: "planTier",
      header: "Plan",
      hideBelow: "lg",
      cell: (org) => <Badge variant="secondary">{org.planTier}</Badge>,
    },
    {
      id: "commissionRateBps",
      header: "Commission",
      align: "right",
      cell: (org) => (
        /*
         * Basis points, rendered as a percentage.
         *
         * A negotiated 12.5% is stored as `1250` precisely so it never has to
         * be a float; dividing by 100 for display is the only place the number
         * becomes one.
         */
        <span className="tabular-nums">{(org.commissionRateBps / 100).toFixed(2)}%</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (org) => <StatusPill status={org.status} />,
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (org) => (
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/admin/clients/${org.id}`}>View</Link>}
        />
      ),
    },
  ]

  const active = all.filter((org) => org.status === "active").length

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Clients"
        subtitle={
          isLoading
            ? "Loading…"
            : `${all.length} tenant ${all.length === 1 ? "organisation" : "organisations"} on the platform`
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        // Not paged: the whole list arrives in one response.
        nextCursor={null}
        getRowId={(org) => org.id}
        table={table}
        caption="Tenant organisations with their plan, commission rate and status"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        rowHref={(org) => `/admin/clients/${org.id}`}
        searchPlaceholder="Search clients, contacts, countries…"
        emptyTitle="No clients yet"
        emptyDescription="Tenant organisations appear here once the platform onboards them."
        facets={[
          {
            id: "status",
            label: "Status",
            options: ["active", "suspended"].map((status) => ({
              label: status,
              value: status,
              count: all.filter((org) => org.status === status).length,
            })),
          },
        ]}
      >
        <StatGrid
          stats={[
            {
              label: "Clients",
              value: isLoading ? "—" : String(all.length),
              icon: "Building2",
            },
            {
              label: "Active",
              value: isLoading ? "—" : String(active),
              icon: "CheckCircle2",
            },
            {
              label: "Suspended",
              value: isLoading ? "—" : String(all.length - active),
              icon: "Ban",
            },
            {
              label: "Average commission",
              value:
                isLoading || all.length === 0
                  ? "—"
                  : `${(
                      all.reduce((sum, org) => sum + org.commissionRateBps, 0) /
                      all.length /
                      100
                    ).toFixed(2)}%`,
              icon: "Percent",
            },
          ]}
        />
      </DataTable>

      <InfoNote>
        Clients are the organisations that own properties. Individual travellers
        who book rooms are managed separately under Guests.
      </InfoNote>
    </div>
  )
}
