"use client"

import Link from "next/link"

import { formatDate } from "@/lib/format"
import {
  adminClients,
  adminSubscriptions,
  clientName,
  monthlyRecurringRevenue,
  overdueBillingAmount,
} from "@/data/admin"
import {
  useAdminCounts,
  useBillingInvoices,
  useMarkInvoicePaid,
} from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import {
  AdminPageHeader,
  ConfirmDialog,
  Money,
  SectionCard,
  StatGrid,
  StatusPill,
} from "@/components/admin/shared"
import { DataTableSkeleton } from "@/components/shared/data-table"
import { ErrorState } from "@/components/shared/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function BillingView() {
  const can = useCan()
  const { data: invoices, isLoading, error, refetch } = useBillingInvoices()
  const markPaid = useMarkInvoicePaid()
  const canMarkPaid = can.do("billing.markPaid")

  // Live: marking an invoice paid should drop the overdue figure immediately.
  const { data: counts } = useAdminCounts()
  const overdue = counts?.money.overdueBilling ?? overdueBillingAmount

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Subscriptions & Billing"
        subtitle="Manage client subscriptions, invoices, and payments"
      />

      <StatGrid
        stats={[
          {
            label: "Monthly Recurring Revenue",
            value: `$${monthlyRecurringRevenue.toLocaleString("en-US")}`,
            caption: "actively billing plans",
            icon: "DollarSign",
          },
          {
            label: "Active Subscriptions",
            value: String(
              adminSubscriptions.filter((s) => s.status === "Active").length
            ),
            icon: "CheckCircle2",
          },
          {
            label: "Overdue Amount",
            value: `$${overdue.toLocaleString("en-US")}`,
            icon: "AlertTriangle",
          },
          {
            label: "Total Clients",
            value: String(adminClients.length),
            icon: "Building2",
          },
        ]}
      />

      <SectionCard
        title={`Subscriptions (${adminSubscriptions.length})`}
        contentClassName="px-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-6">Client</TableHead>
              <TableHead scope="col">Plan</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="text-right">Amount</TableHead>
              <TableHead scope="col">Billing</TableHead>
              <TableHead scope="col">Next billing</TableHead>
              <TableHead scope="col" className="pr-6">Payment method</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adminSubscriptions.map((subscription) => (
              <TableRow key={subscription.id}>
                <TableCell className="pl-6">
                  <Link
                    href={`/admin/clients/${subscription.clientId}`}
                    className="hover:text-primary font-medium underline-offset-2 hover:underline"
                  >
                    {clientName(subscription.clientId)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{subscription.plan}</Badge>
                </TableCell>
                <TableCell>
                  <StatusPill status={subscription.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Money value={subscription.amount} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {subscription.interval}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(subscription.nextBilling)}
                </TableCell>
                <TableCell className="text-muted-foreground pr-6">
                  {subscription.paymentMethod}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard title="Recent invoices" contentClassName="px-0">
        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isLoading || !invoices ? (
          <DataTableSkeleton columns={6} rows={6} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col" className="pl-6">Invoice</TableHead>
                <TableHead scope="col">Client</TableHead>
                <TableHead scope="col">Description</TableHead>
                <TableHead scope="col" className="text-right">Amount</TableHead>
                <TableHead scope="col">Status</TableHead>
                <TableHead scope="col">Due</TableHead>
                <TableHead scope="col" className="pr-6 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="pl-6 font-medium">
                    {invoice.id}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/clients/${invoice.clientId}`}
                      className="hover:text-primary underline-offset-2 hover:underline"
                    >
                      {clientName(invoice.clientId)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {invoice.description}
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={invoice.amount} />
                  </TableCell>
                  <TableCell>
                    <StatusPill status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(invoice.due)}
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    {invoice.status !== "Paid" && canMarkPaid ? (
                      <ConfirmDialog
                        trigger={
                          <Button variant="ghost" size="sm">
                            Mark paid
                          </Button>
                        }
                        title={`Mark ${invoice.id} as paid?`}
                        description="Use this only when payment has been confirmed outside the platform."
                        confirmLabel="Mark paid"
                        onConfirm={() => markPaid.mutate({ id: invoice.id })}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  )
}
