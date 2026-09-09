"use client"

import * as React from "react"
import Link from "next/link"

import type { AdminUserRow } from "@/lib/admin/api/endpoints"
import { useUpdateUser, useUsers } from "@/lib/admin/api/hooks"
import { formatDate } from "@/lib/format"
import { useCan } from "@/components/admin/role-provider"
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
import { UserStatusDialog } from "./user-status-dialog"

/**
 * The accounts the platform administers directly.
 *
 * Partner accounts and the platform's own staff — not travellers, who are
 * under Guests. What the platform can do here is exactly two things, because
 * they are the two the API offers: change what an account may reach, and
 * suspend it. Both need a reason and both land in the audit log.
 *
 * **There is no "Invite manager".** The old screen had one, and the platform
 * has no endpoint for it — inviting somebody into an organisation is that
 * organisation's own act (`POST /partner/team/invites`), which is right: the
 * platform onboards a business, and the business decides who works there.
 * Approving a registration is what creates an organisation and its first
 * admin, in one transaction (rule #103).
 *
 * The "Client" and "Assigned properties" columns are gone with it: the list
 * endpoint returns accounts, not memberships. A client's team is on that
 * client's own page, where it belongs and where it is complete.
 */
export function UsersView() {
  const can = useCan()
  const table = useDataTable()

  /*
   * Partners by default, because that is who this screen is about.
   *
   * The role facet can widen it to the platform's own staff; it cannot reach
   * travellers, who have their own screen with their own counts.
   */
  const query = React.useMemo(
    () => ({ role: "partner", ...table.query }),
    [table.query]
  )

  const { data, isLoading, isFetching, error, refetch } = useUsers(query)
  const update = useUpdateUser()
  const canManage = can.manage("users")

  const [pending, setPending] = React.useState<{
    user: AdminUserRow
    next: "active" | "suspended"
  } | null>(null)

  const counts = data?.counts ?? {}
  const active = counts.active ?? 0
  const suspended = counts.suspended ?? 0

  const columns: Column<AdminUserRow>[] = [
    {
      id: "name",
      header: "Account",
      cell: (user) => (
        <CellStack
          primary={`${user.firstName} ${user.lastName}`.trim() || user.email}
          secondary={user.email}
          href={`/admin/guests/${user.id}`}
        />
      ),
    },
    {
      id: "role",
      header: "Reaches",
      cell: (user) => <Badge variant="secondary">{user.role}</Badge>,
    },
    {
      id: "emailVerifiedAt",
      header: "Email",
      hideBelow: "lg",
      cell: (user) => (
        <span className="text-muted-foreground text-sm">
          {user.emailVerifiedAt ? "Verified" : "Not verified"}
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Created",
      hideBelow: "xl",
      cell: (user) => (
        <span className="text-muted-foreground">{formatDate(user.createdAt)}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (user) => <StatusPill status={user.status} />,
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (user) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/admin/guests/${user.id}`}>View</Link>}
          />
          {canManage ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setPending({
                  user,
                  next: user.status === "active" ? "suspended" : "active",
                })
              }
            >
              {user.status === "active" ? "Suspend" : "Restore"}
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Managers & Users"
        subtitle={
          isLoading
            ? "Loading…"
            : `${active + suspended} ${query.role ?? "platform"} accounts`
        }
      />

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        nextCursor={data?.nextCursor ?? null}
        getRowId={(user) => user.id}
        table={table}
        caption="Partner and platform accounts with what they reach and their status"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        searchPlaceholder="Search by name or email…"
        emptyTitle="No accounts"
        emptyDescription="Partner accounts appear here once a registration is approved."
        facets={[
          {
            id: "role",
            label: "Reaches",
            options: [
              { label: "Partner extranet", value: "partner" },
              { label: "This admin panel", value: "admin" },
            ],
          },
          {
            id: "status",
            label: "Status",
            options: [
              { label: "Active", value: "active", count: active },
              { label: "Suspended", value: "suspended", count: suspended },
            ],
          },
        ]}
      >
        <StatGrid
          stats={[
            {
              label: "Accounts",
              value: isLoading ? "—" : String(active + suspended),
              icon: "Users",
            },
            {
              label: "Active",
              value: isLoading ? "—" : String(active),
              icon: "CheckCircle2",
            },
            {
              label: "Suspended",
              value: isLoading ? "—" : String(suspended),
              icon: "Ban",
            },
          ]}
        />
      </DataTable>

      <InfoNote>
        A partner account belongs to a client organisation, and that
        organisation invites its own team. To see who works where, open the
        client. Suspending an account here stops it signing in anywhere.
      </InfoNote>

      <UserStatusDialog
        pending={pending}
        onClose={() => setPending(null)}
        isSubmitting={update.isPending}
        onConfirm={(reason) => {
          if (!pending) return
          update.mutate(
            {
              userId: pending.user.id,
              body: {
                // The role is unchanged; the schema wants all three fields.
                role: pending.user.role,
                status: pending.next,
                reason,
              },
            },
            { onSuccess: () => setPending(null) }
          )
        }}
      />
    </div>
  )
}
