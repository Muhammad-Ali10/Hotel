"use client"

import * as React from "react"
import Link from "next/link"

import { formatCurrency, formatDate } from "@/lib/format"
import { toISODate } from "@/lib/domain"
import { useClients, useInvoices } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  AdminPageHeader,
  InfoNote,
  SectionCard,
  StatGrid,
} from "@/components/admin/shared"
import { DataTableSkeleton } from "@/components/shared/data-table"
import { ErrorState } from "@/components/shared/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { SettlementModeDialog } from "./settlement-mode-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * How the platform collects its commission, per client (rules #91–#95).
 *
 * This screen used to show subscriptions: a plan per client, a monthly amount,
 * a next-billing date, and "Monthly Recurring Revenue" across the top. None of
 * it existed. Nothing charged the amount, nothing scheduled the interval, and
 * the MRR figure was the sum of numbers no invoice ever produced.
 *
 * Stayora earns COMMISSION. The only real choice is when it is taken:
 *
 *   **Deduct** — held back from each payout. The platform is never exposed.
 *   **Invoice** — the property is paid in full and billed at month end.
 *
 * `Invoice` is a privilege the platform grants and can take back. An unpaid
 * bill holds a client's payouts — but their listings stay up (rule #95), and
 * that is deliberate: a guest who booked has done nothing wrong.
 *
 * The invoices themselves are under Finance. This screen is about the terms.
 */
export function BillingView() {
  const can = useCan()
  const clients = useClients()
  const invoices = useInvoices({ status: "issued", limit: 100 })

  const [pending, setPending] = React.useState<{
    orgId: string
    orgName: string
    mode: "deduct" | "invoice"
  } | null>(null)

  const canChange = can.do("billing.markPaid")
  const today = toISODate(new Date())

  /*
   * What each client owes, from the unpaid invoices.
   *
   * The client list does not carry a settlement mode — the API keeps that on
   * the invoicing side — so a client with unpaid invoices is one on `invoice`
   * terms, and everybody else settles by deduction. That inference is stated
   * rather than hidden, because it is an inference.
   */
  const owedByOrg = React.useMemo(() => {
    const map = new Map<string, { amount: number; count: number; overdue: number }>()
    for (const invoice of invoices.data ?? []) {
      const current = map.get(invoice.partnerOrgId) ?? {
        amount: 0,
        count: 0,
        overdue: 0,
      }
      current.amount += invoice.amount
      current.count += 1
      if (invoice.dueDate < today) current.overdue += 1
      map.set(invoice.partnerOrgId, current)
    }
    return map
  }, [invoices.data, today])

  const totalOwed = React.useMemo(
    () => [...owedByOrg.values()].reduce((sum, o) => sum + o.amount, 0),
    [owedByOrg]
  )
  const clientsOverdue = React.useMemo(
    () => [...owedByOrg.values()].filter((o) => o.overdue > 0).length,
    [owedByOrg]
  )

  const rows = clients.data ?? []

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Settlement Terms"
        subtitle="How each client's commission is collected, and what is outstanding"
      />

      <StatGrid
        className="lg:grid-cols-4"
        stats={[
          {
            label: "Clients",
            value: clients.isLoading ? "—" : String(rows.length),
            icon: "Building2",
          },
          {
            label: "Billed by invoice",
            value: invoices.isLoading ? "—" : String(owedByOrg.size),
            caption: "have unpaid invoices",
            icon: "Receipt",
          },
          {
            label: "Outstanding",
            value: invoices.isLoading ? "—" : formatCurrency(totalOwed),
            icon: "Wallet",
          },
          {
            label: "Overdue",
            value: invoices.isLoading ? "—" : String(clientsOverdue),
            caption: "clients past a due date",
            icon: "AlertTriangle",
          },
        ]}
      />

      <SectionCard
        title="By client"
        description="Switching to Invoice pays a client in full and bills them at month end. Switching to Deduct takes commission off each payout."
        contentClassName="px-0"
      >
        {clients.isLoading ? (
          <DataTableSkeleton columns={5} rows={5} />
        ) : clients.error ? (
          <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-6">
                  Client
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Commission
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Outstanding
                </TableHead>
                <TableHead scope="col">Payouts</TableHead>
                <TableHead scope="col" className="pr-6 text-right">
                  Collect by
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((client) => {
                const owed = owedByOrg.get(client.id)
                const held = (owed?.count ?? 0) > 0
                return (
                  <TableRow key={client.id}>
                    <TableCell className="pl-6">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="hover:text-primary font-medium underline-offset-2 hover:underline"
                      >
                        {client.name}
                      </Link>
                      <span className="text-muted-foreground block text-xs">
                        {client.contactEmail}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {(client.commissionRateBps / 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {owed ? (
                        <>
                          {formatCurrency(owed.amount)}
                          {owed.overdue > 0 ? (
                            <span className="text-destructive block text-xs">
                              {owed.overdue} overdue
                            </span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {held ? (
                        <Badge variant="outline" className="text-destructive">
                          held
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          flowing
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      {canChange ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() =>
                              setPending({
                                orgId: client.id,
                                orgName: client.name,
                                mode: "deduct",
                              })
                            }
                          >
                            Deduct
                          </Button>
                          <Button
                            variant="ghost"
                            size="xs"
                            onClick={() =>
                              setPending({
                                orgId: client.id,
                                orgName: client.name,
                                mode: "invoice",
                              })
                            }
                          >
                            Invoice
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                    No clients yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </SectionCard>

      <InfoNote>
        &ldquo;Outstanding&rdquo; is read from unpaid invoices, so a client with
        none simply settles by deduction. The invoices themselves — and marking
        one paid — are under{" "}
        <Link href="/admin/finance/invoices" className="underline">
          Finance
        </Link>
        . Last updated {formatDate(today)}.
      </InfoNote>

      <SettlementModeDialog pending={pending} onClose={() => setPending(null)} />
    </div>
  )
}
