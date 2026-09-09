"use client"

import * as React from "react"
import Link from "next/link"
import { ShieldCheck, UserMinus } from "lucide-react"

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
import {
  DataTable,
  useDataTable,
  type BulkAction,
  type Column,
} from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GuestStatusDialog, type UserStatus } from "./guest-status-dialog"

/**
 * Registered travellers.
 *
 * This is the table the Figma titled "Clients & Guests" under a "Clients" nav
 * item; it sits under Guests so "Client" can mean the tenant organisation
 * everywhere (Phase 1, D3).
 *
 * Four columns the mock carried are gone from the LIST and live on the detail:
 * phone, country, lifetime bookings and lifetime spend. The list endpoint does
 * not return them, and it is right not to — computing a spend total for fifty
 * guests on every keystroke is fifty aggregate queries to fill a column
 * nobody sorts by. `GET /admin/users/:id` has all four.
 */
export function GuestsView() {
  const can = useCan()
  const table = useDataTable()

  // Always scoped to travellers: partners and staff are a different screen.
  const query = React.useMemo(
    () => ({ ...table.query, role: "customer" as const }),
    [table.query]
  )

  const { data, isLoading, isFetching, error, refetch } = useUsers(query)
  const update = useUpdateUser()

  const [pending, setPending] = React.useState<{
    users: AdminUserRow[]
    next: UserStatus
  } | null>(null)

  const canSuspend = can.do("guest.suspend")

  const counts = data?.counts ?? {}
  const active = counts.active ?? 0
  const suspended = counts.suspended ?? 0

  const columns: Column<AdminUserRow>[] = [
    {
      id: "name",
      header: "Guest",
      cell: (user) => (
        <CellStack
          primary={`${user.firstName} ${user.lastName}`.trim() || user.email}
          secondary={user.email}
          href={`/admin/guests/${user.id}`}
        />
      ),
    },
    {
      id: "tier",
      header: "Tier",
      hideBelow: "md",
      cell: (user) => <Badge variant="secondary">{user.tier}</Badge>,
    },
    {
      id: "emailVerifiedAt",
      header: "Email",
      hideBelow: "lg",
      cell: (user) =>
        user.emailVerifiedAt ? (
          <span className="text-muted-foreground text-sm">Verified</span>
        ) : (
          /*
           * Worth showing, not worth alarming about.
           *
           * An unverified address is why a booking confirmation bounced, which
           * is the single most common thing support is asked to explain.
           */
          <span className="text-muted-foreground text-sm">Not verified</span>
        ),
    },
    {
      id: "createdAt",
      header: "Joined",
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
          {canSuspend ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setPending({
                  users: [user],
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

  const bulkActions: BulkAction<AdminUserRow>[] = [
    {
      id: "suspend",
      label: "Suspend",
      icon: UserMinus,
      destructive: true,
      hidden: !canSuspend,
      onRun: (_ids, users) => setPending({ users, next: "suspended" }),
    },
    {
      id: "restore",
      label: "Restore",
      icon: ShieldCheck,
      hidden: !canSuspend,
      onRun: (_ids, users) => setPending({ users, next: "active" }),
    },
  ]

  /**
   * One at a time, and the reason goes on every one.
   *
   * The API takes a single account per call — deliberately, since each change
   * is its own audit line with its own reason. Firing them together would
   * race several writes at the same audit table for no gain; sequential is
   * slower and is what somebody wants when the third of five is refused.
   */
  async function applyPending(reason: string) {
    if (!pending) return
    for (const user of pending.users) {
      await update
        .mutateAsync({
          userId: user.id,
          body: { role: user.role, status: pending.next, reason },
        })
        .catch(() => undefined)
    }
    setPending(null)
    table.clearSelection()
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Guests"
        subtitle={
          isLoading
            ? "Loading…"
            : `${active + suspended} registered travellers`
        }
      />

      <DataTable
        columns={columns}
        rows={data?.items ?? []}
        nextCursor={data?.nextCursor ?? null}
        getRowId={(user) => user.id}
        table={table}
        caption="Registered guests with tier, verification and account status"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        rowHref={(user) => `/admin/guests/${user.id}`}
        searchPlaceholder="Search guests by name or email…"
        bulkActions={bulkActions}
        emptyTitle="No guests yet"
        emptyDescription="Travellers appear here once they register."
        facets={[
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
              label: "Guests",
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
        These are registered travellers who book rooms on the marketplace.
        Suspending stops sign-in and new bookings; reservations they already
        hold are untouched. Every change is recorded in the audit log with the
        reason given.
      </InfoNote>

      <GuestStatusDialog
        pending={pending}
        onClose={() => setPending(null)}
        isSubmitting={update.isPending}
        onConfirm={(reason) => void applyPending(reason)}
      />
    </div>
  )
}
