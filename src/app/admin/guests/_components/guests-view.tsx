"use client"

import * as React from "react"
import Link from "next/link"
import { Ban, ShieldCheck, UserMinus } from "lucide-react"

import type { Guest, GuestStatus } from "@/lib/admin/types"
import { guestCounts } from "@/data/admin"
import {
  useAdminCounts,
  useGuests,
  useSetGuestStatus,
} from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  AdminPageHeader,
  CellStack,
  InfoNote,
  Money,
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
import { GuestStatusDialog } from "./guest-status-dialog"

/**
 * Registered travellers. This is the table the Figma titled "Clients & Guests"
 * under a "Clients" nav item; it now sits under Guests so "Client" can mean
 * the tenant organisation everywhere (Phase 1, D3).
 */
export function GuestsView() {
  const can = useCan()
  const table = useDataTable({ sortBy: "name" })
  const { data, isLoading, isFetching, error, refetch } = useGuests(table.params)
  const setStatus = useSetGuestStatus()

  // Live counts, so the tiles move when a guest is suspended or restored.
  const { data: counts } = useAdminCounts()
  const total = counts?.totals.guests ?? guestCounts.total
  const active = counts?.guests.Active ?? guestCounts.active
  const suspended = counts?.guests.Suspended ?? guestCounts.suspended
  const blocked = counts?.guests.Blocked ?? guestCounts.blocked

  const [pending, setPending] = React.useState<{
    guests: Guest[]
    next: GuestStatus
  } | null>(null)

  const canSuspend = can.do("guest.suspend")
  const canBlock = can.do("guest.block")

  const columns: Column<Guest>[] = [
    {
      id: "name",
      header: "Guest",
      sortable: true,
      cell: (guest) => (
        <CellStack
          primary={guest.name}
          secondary={guest.id}
          href={`/admin/guests/${guest.id}`}
        />
      ),
    },
    {
      id: "email",
      header: "Email",
      sortable: true,
      hideBelow: "md",
      cell: (guest) => (
        <span className="text-muted-foreground">{guest.email}</span>
      ),
    },
    {
      id: "phone",
      header: "Phone",
      hideBelow: "xl",
      cell: (guest) => (
        <span className="text-muted-foreground tabular-nums">{guest.phone}</span>
      ),
    },
    {
      id: "country",
      header: "Country",
      sortable: true,
      hideBelow: "lg",
      cell: (guest) => guest.country,
    },
    {
      id: "bookings",
      header: "Bookings",
      sortable: true,
      align: "right",
      cell: (guest) => <span className="tabular-nums">{guest.bookings}</span>,
    },
    {
      id: "totalSpent",
      header: "Total spent",
      sortable: true,
      align: "right",
      cell: (guest) => <Money value={guest.totalSpent} />,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      cell: (guest) => <StatusPill status={guest.status} />,
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (guest) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            render={<Link href={`/admin/guests/${guest.id}`}>View</Link>}
          />
          {guest.status === "Active" && canSuspend ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPending({ guests: [guest], next: "Suspended" })}
            >
              Suspend
            </Button>
          ) : null}
          {guest.status !== "Active" && canSuspend ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPending({ guests: [guest], next: "Active" })}
            >
              {guest.status === "Blocked" ? "Unblock" : "Restore"}
            </Button>
          ) : null}
        </div>
      ),
    },
  ]

  const bulkActions: BulkAction<Guest>[] = [
    {
      id: "suspend",
      label: "Suspend",
      icon: UserMinus,
      hidden: !canSuspend,
      onRun: (_ids, guests) => setPending({ guests, next: "Suspended" }),
    },
    {
      id: "block",
      label: "Block",
      icon: Ban,
      destructive: true,
      hidden: !canBlock,
      onRun: (_ids, guests) => setPending({ guests, next: "Blocked" }),
    },
    {
      id: "restore",
      label: "Restore",
      icon: ShieldCheck,
      hidden: !canSuspend,
      onRun: (_ids, guests) => setPending({ guests, next: "Active" }),
    },
  ]

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Guests"
        subtitle={`${total} registered travellers who have booked rooms`}
      />

      <DataTable
        columns={columns}
        rows={data?.rows ?? []}
        total={data?.total ?? 0}
        getRowId={(guest) => guest.id}
        table={table}
        caption="Registered guests with booking counts, spend and account status"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        rowHref={(guest) => `/admin/guests/${guest.id}`}
        searchPlaceholder="Search guests by name, email, phone…"
        bulkActions={bulkActions}
        emptyTitle="No guests yet"
        emptyDescription="Travellers appear here after their first booking."
        facets={[
          {
            id: "status",
            label: "Status",
            options: [
              { label: "Active", value: "Active", count: active },
              { label: "Suspended", value: "Suspended", count: suspended },
              { label: "Blocked", value: "Blocked", count: blocked },
            ],
          },
        ]}
      >
        <StatGrid
          stats={[
            { label: "Total Guests", value: String(total), icon: "Users" },
            { label: "Active", value: String(active), icon: "CheckCircle2" },
            { label: "Suspended", value: String(suspended), icon: "Clock" },
            { label: "Blocked", value: String(blocked), icon: "Ban" },
          ]}
        />
      </DataTable>

      <InfoNote>
        These are registered travellers who book rooms on the marketplace.
        Suspending blocks new bookings; blocking also prevents sign-in. Both
        actions are recorded in the audit log.
      </InfoNote>

      <GuestStatusDialog
        pending={pending}
        onClose={() => setPending(null)}
        isSubmitting={setStatus.isPending}
        onConfirm={(reason) => {
          if (!pending) return
          for (const guest of pending.guests) {
            setStatus.mutate({ id: guest.id, status: pending.next, reason })
          }
          setPending(null)
          table.clearSelection()
        }}
      />
    </div>
  )
}
