"use client"

import Link from "next/link"

import type { Manager } from "@/lib/admin/types"
import { adminClients, adminManagers, clientName, propertyName } from "@/data/admin"
import {
  useAdminCounts,
  useManagers,
  useSetManagerStatus,
} from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  AdminPageHeader,
  CellStack,
  ConfirmDialog,
  InfoNote,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { InviteManagerDialog } from "./invite-manager-dialog"

const ROLES = [
  "Owner",
  "General Manager",
  "Revenue Manager",
  "Front Desk Manager",
  "Staff",
]
const STATUSES = ["Active", "Invited", "Suspended"]

/** Tenant-side staff accounts, administered from the platform. */
export function UsersView() {
  const can = useCan()
  const table = useDataTable({ sortBy: "name" })
  const { data, isLoading, isFetching, error, refetch } = useManagers(
    table.params
  )
  const setStatus = useSetManagerStatus()
  const canInvite = can.do("manager.invite")
  const canManage = can.manage("users")

  // Live counts, so inviting or suspending updates the tiles immediately.
  const { data: counts } = useAdminCounts()
  const total = counts?.totals.managers ?? adminManagers.length
  const statusCount = (status: string) =>
    counts?.managers[status] ??
    adminManagers.filter((m) => m.status === status).length

  const columns: Column<Manager>[] = [
    {
      id: "name",
      header: "Manager",
      sortable: true,
      cell: (manager) => (
        <CellStack primary={manager.name} secondary={manager.email} />
      ),
    },
    {
      id: "role",
      header: "Role",
      sortable: true,
      cell: (manager) => <Badge variant="secondary">{manager.role}</Badge>,
    },
    {
      id: "client",
      header: "Client",
      sortable: true,
      hideBelow: "md",
      cell: (manager) => (
        <Link
          href={`/admin/clients/${manager.clientId}`}
          className="hover:text-primary underline-offset-2 hover:underline"
        >
          {clientName(manager.clientId)}
        </Link>
      ),
    },
    {
      id: "properties",
      header: "Assigned properties",
      hideBelow: "xl",
      cell: (manager) => (
        <span className="text-muted-foreground text-xs">
          {manager.propertyIds.length === 0
            ? "—"
            : manager.propertyIds.map(propertyName).join(", ")}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (manager) => <StatusPill status={manager.status} />,
    },
    {
      id: "lastLogin",
      header: "Last login",
      sortable: true,
      hideBelow: "lg",
      cell: (manager) => (
        <span className="text-muted-foreground tabular-nums">
          {manager.lastLogin ?? "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (manager) => {
        if (!canManage) return null
        return (
          <div className="flex justify-end gap-1">
            {manager.status === "Invited" ? (
              <ConfirmDialog
                trigger={<Button variant="ghost" size="sm">Resend invite</Button>}
                title={`Resend invitation to ${manager.email}?`}
                description="A fresh invitation link is emailed; the previous link stops working."
                confirmLabel="Resend"
                toastMessage="Invitation resent."
              />
            ) : null}
            {manager.status === "Suspended" ? (
              <ConfirmDialog
                trigger={<Button variant="ghost" size="sm">Restore</Button>}
                title={`Restore ${manager.name}?`}
                description="Access to the client's extranet is restored immediately."
                confirmLabel="Restore"
                onConfirm={() =>
                  setStatus.mutate({ id: manager.id, status: "Active" })
                }
              />
            ) : (
              <ConfirmDialog
                trigger={<Button variant="ghost" size="sm">Suspend</Button>}
                title={`Suspend ${manager.name}?`}
                description="The manager is signed out and cannot access the extranet until restored."
                confirmLabel="Suspend"
                destructive
                onConfirm={() =>
                  setStatus.mutate({ id: manager.id, status: "Suspended" })
                }
              />
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Managers & Users"
        subtitle={`${total} managers across all clients`}
      >
        {canInvite ? <InviteManagerDialog /> : null}
      </AdminPageHeader>

      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        total={data?.total ?? 0}
        getRowId={(manager) => manager.id}
        table={table}
        caption="Tenant-side manager accounts with role, client and status"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        searchPlaceholder="Search managers, emails, clients…"
        emptyTitle="No managers yet"
        emptyDescription="Invite a manager to give a client access to their extranet."
        emptyAction={canInvite ? <InviteManagerDialog /> : undefined}
        facets={[
          {
            id: "status",
            label: "Status",
            options: STATUSES.map((status) => ({
              label: status,
              value: status,
              count: statusCount(status),
            })),
          },
          {
            id: "role",
            label: "Role",
            options: ROLES.map((role) => ({
              label: role,
              value: role,
              count:
                counts?.roles[role] ??
                adminManagers.filter((m) => m.role === role).length,
            })),
          },
          {
            id: "client",
            label: "Client",
            options: adminClients.map((client) => ({
              label: client.name,
              value: client.name,
              count:
                counts?.managersPerClient[client.name] ??
                adminManagers.filter((m) => m.clientId === client.id).length,
            })),
          },
        ]}
      >
        <StatGrid
          stats={[
            { label: "Total Managers", value: String(total), icon: "Users" },
            {
              label: "Active",
              value: String(statusCount("Active")),
              icon: "CheckCircle2",
            },
            {
              label: "Invited",
              value: String(statusCount("Invited")),
              icon: "Mail",
            },
            {
              label: "Suspended",
              value: String(statusCount("Suspended")),
              icon: "AlertTriangle",
            },
          ]}
        />
      </DataTable>

      <InfoNote>
        These are tenant-side accounts that sign in to the partner extranet.
        Platform admin roles are configured under Settings.
      </InfoNote>
    </div>
  )
}
