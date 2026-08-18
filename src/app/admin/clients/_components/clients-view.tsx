"use client"

import Link from "next/link"

import type { Client } from "@/lib/admin/types"
import {
  adminClients,
  propertiesForClient,
  revenueForClient,
} from "@/data/admin"
import { useClients } from "@/lib/admin/api/hooks"
import {
  AdminPageHeader,
  CellStack,
  InfoNote,
  Money,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const PLANS = ["Starter", "Professional", "Enterprise"]
const STATUSES = ["Active", "Trial", "Past Due", "Suspended"]

/**
 * Tenant organisations — the "Client" every other screen links to.
 *
 * This screen does not exist in the Figma: its sidebar's "Clients" item opened
 * a list of individual travellers while Billing, Finance, Analytics and
 * Properties all referenced tenant orgs that had no page. Phase 1 decision D3
 * split the two; travellers now live at `/admin/guests`.
 */
export function ClientsView() {
  const table = useDataTable({ sortBy: "name" })
  const { data, isLoading, isFetching, error, refetch } = useClients(table.params)

  const columns: Column<Client>[] = [
    {
      id: "name",
      header: "Client",
      sortable: true,
      cell: (client) => (
        <CellStack
          primary={client.name}
          secondary={client.id}
          href={`/admin/clients/${client.id}`}
        />
      ),
    },
    {
      id: "contactPerson",
      header: "Contact",
      sortable: true,
      hideBelow: "lg",
      cell: (client) => (
        <CellStack primary={client.contactPerson} secondary={client.email} />
      ),
    },
    {
      id: "country",
      header: "Country",
      sortable: true,
      hideBelow: "xl",
      cell: (client) => client.country,
    },
    {
      id: "plan",
      header: "Plan",
      sortable: true,
      cell: (client) => <Badge variant="secondary">{client.plan}</Badge>,
    },
    {
      id: "properties",
      header: "Properties",
      align: "right",
      hideBelow: "md",
      cell: (client) => (
        <span className="tabular-nums">
          {propertiesForClient(client.id).length}
        </span>
      ),
    },
    {
      id: "monthlyRevenue",
      header: "Monthly revenue",
      sortable: true,
      align: "right",
      cell: (client) => <Money value={client.monthlyRevenue} />,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (client) => <StatusPill status={client.status} />,
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (client) => (
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/admin/clients/${client.id}`}>View</Link>}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Clients"
        subtitle={`${adminClients.length} tenant organisations on the platform`}
      />

      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        total={data?.total ?? 0}
        getRowId={(client) => client.id}
        table={table}
        caption="Tenant organisations with their plan, property count and monthly revenue"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        rowHref={(client) => `/admin/clients/${client.id}`}
        searchPlaceholder="Search clients, contacts, countries…"
        emptyTitle="No clients yet"
        emptyDescription="Tenant organisations appear here once they complete onboarding."
        facets={[
          {
            id: "plan",
            label: "Plan",
            options: PLANS.map((plan) => ({
              label: plan,
              value: plan,
              count: adminClients.filter((c) => c.plan === plan).length,
            })),
          },
          {
            id: "status",
            label: "Status",
            options: STATUSES.map((status) => ({
              label: status,
              value: status,
              count: adminClients.filter((c) => c.status === status).length,
            })),
          },
        ]}
      >
        <StatGrid
          stats={[
            {
              label: "Total Clients",
              value: String(adminClients.length),
              icon: "Building2",
            },
            {
              label: "Active",
              value: String(
                adminClients.filter((c) => c.status === "Active").length
              ),
              icon: "CheckCircle2",
            },
            {
              label: "On Trial",
              value: String(
                adminClients.filter((c) => c.status === "Trial").length
              ),
              icon: "Clock",
            },
            {
              label: "Combined Revenue YTD",
              value: `$${(
                adminClients.reduce((sum, c) => sum + revenueForClient(c.id), 0) /
                1_000_000
              ).toFixed(1)}M`,
              icon: "DollarSign",
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
