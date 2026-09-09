"use client"

import * as React from "react"
import Link from "next/link"

import { formatCurrency, formatDate } from "@/lib/format"
import type { AdminPayout } from "@/lib/admin/api/endpoints"
import { usePayouts, useRetryPayout } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  CellStack,
  InfoNote,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import { DataTable, useDataTable, type Column } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"

const STATUSES = [
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Paid", value: "paid" },
  { label: "Failed", value: "failed" },
]

/**
 * Settlements, across every client.
 *
 * `net` is SIGNED (rule #52). A period whose refunds outweighed its takings
 * leaves the property owing the platform, and this screen says so in words
 * rather than showing a smaller positive number — the mock's `Money` component
 * would have rendered a debt as an amount owed the other way.
 *
 * `carryIn` is what a previous period could not settle and pushed forward, so
 * gross minus commission does not equal net and is not supposed to.
 *
 * A failed payout shows the reason the provider gave. "Payout failed" with no
 * cause is a support ticket; "the bank rejected the account details" is
 * something somebody can act on this afternoon.
 */
export function PayoutsView() {
  const can = useCan()
  const table = useDataTable()
  const { data, isLoading, isFetching, error, refetch } = usePayouts(table.query)
  const retry = useRetryPayout()
  const canRetry = can.do("payout.retry")

  const rows = React.useMemo(() => data ?? [], [data])

  /*
   * Summed over what came back, and labelled as such.
   *
   * The payouts endpoint returns a capped list, not an aggregate. Finance
   * Overview answers "how much is owed" properly, for a window.
   */
  const onPage = React.useMemo(() => {
    let paid = 0
    let pending = 0
    let failed = 0
    for (const payout of rows) {
      if (payout.status === "paid") paid += payout.net
      else if (payout.status === "failed") failed += 1
      else pending += payout.net
    }
    return { paid, pending, failed }
  }, [rows])

  const columns: Column<AdminPayout>[] = [
    {
      id: "org",
      header: "Client",
      cell: (payout) => (
        <CellStack
          primary={payout.orgName}
          secondary={`${formatDate(payout.periodStart)} – ${formatDate(payout.periodEnd)}`}
          href={`/admin/clients/${payout.orgId}`}
        />
      ),
    },
    {
      id: "gross",
      header: "Gross",
      align: "right",
      hideBelow: "lg",
      cell: (payout) => (
        <span className="tabular-nums">{formatCurrency(payout.gross)}</span>
      ),
    },
    {
      id: "commission",
      header: "Commission",
      align: "right",
      hideBelow: "lg",
      cell: (payout) => (
        <span className="tabular-nums">
          {formatCurrency(payout.commission)}
        </span>
      ),
    },
    {
      id: "carryIn",
      header: "Carried in",
      align: "right",
      hideBelow: "xl",
      cell: (payout) => (
        <span className="tabular-nums">
          {payout.carryIn === 0 ? "—" : formatCurrency(payout.carryIn)}
        </span>
      ),
    },
    {
      id: "net",
      header: "Net",
      align: "right",
      cell: (payout) =>
        payout.net < 0 ? (
          <span className="text-destructive tabular-nums">
            {formatCurrency(Math.abs(payout.net))} owed back
          </span>
        ) : (
          <span className="font-medium tabular-nums">
            {formatCurrency(payout.net)}
          </span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: (payout) => (
        <div className="space-y-1">
          <StatusPill status={payout.status} />
          {payout.paidAt ? (
            <p className="text-muted-foreground text-xs">
              {formatDate(payout.paidAt)}
            </p>
          ) : null}
          {payout.failureReason ? (
            <p className="text-destructive text-xs text-pretty">
              {payout.failureReason}
            </p>
          ) : null}
        </div>
      ),
    },
    {
      id: "actions",
      header: "",
      hideable: false,
      align: "right",
      cell: (payout) =>
        canRetry && payout.status === "failed" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={retry.isPending}
            onClick={() => retry.mutate(payout.id)}
          >
            Retry
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="space-y-6">
      <DataTable
        columns={columns}
        rows={rows}
        // Capped, not paged: the endpoint returns at most a hundred.
        nextCursor={null}
        getRowId={(payout) => payout.id}
        table={table}
        caption="Settlements across every client with their status and any failure reason"
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRetry={() => void refetch()}
        emptyTitle="No settlements yet"
        emptyDescription="The first one is cut once a stay has been completed."
        facets={[{ id: "status", label: "Status", options: STATUSES }]}
      >
        <StatGrid
          className="lg:grid-cols-3"
          stats={[
            {
              label: "Paid out",
              value: isLoading ? "—" : formatCurrency(onPage.paid),
              caption: "in this list",
              icon: "CheckCircle2",
            },
            {
              label: "Waiting to be paid",
              value: isLoading ? "—" : formatCurrency(onPage.pending),
              caption: "in this list",
              icon: "Clock",
            },
            {
              label: "Failed",
              value: isLoading ? "—" : String(onPage.failed),
              caption: "need a retry",
              icon: "AlertTriangle",
            },
          ]}
        />
      </DataTable>

      <InfoNote>
        A negative settlement means refunds outweighed takings for that period,
        so the balance is owed back rather than paid out. It carries into the
        next one rather than being written off. Retrying a failed payout sends
        it to the provider again — it does not change where the money goes.{" "}
        <Link href="/admin/clients" className="underline">
          Payout accounts are verified on the client
        </Link>
        .
      </InfoNote>
    </div>
  )
}
