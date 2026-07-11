import Link from "next/link"
import { ArrowRight, Download, Wallet } from "lucide-react"

import { financeStats, revenueByProperty } from "@/data/extranet"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatNumber } from "@/lib/format"
import {
  ActionButton,
  ConfirmDialog,
  DeltaBadge,
  PageHeader,
  SectionCard,
  StatGrid,
} from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

function TabSummary({
  note,
  href,
  label,
}: {
  note: string
  href: string
  label: string
}) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
        <p className="text-muted-foreground max-w-md text-sm">{note}</p>
        <Button size="sm" render={<Link href={href} />}>
          {label}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </Card>
  )
}

// Balance available for the partner to withdraw (mock — the "Pending Payouts" KPI).
const availableBalance =
  financeStats.find((s) => s.label === "Pending Payouts")?.value ?? "$0"

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        subtitle="Revenue, commissions, payouts, and invoice management across all properties"
      >
        <ActionButton
          variant="outline"
          size="sm"
          toastType="info"
          toastMessage="Exporting finance report…"
        >
          <Download className="size-4" />
          Export Report
        </ActionButton>
        <ConfirmDialog
          trigger={
            <Button size="sm">
              <Wallet className="size-4" />
              Request Payout
            </Button>
          }
          title="Request Payout"
          description={`Request payout of ${availableBalance}?`}
          confirmLabel="Request Payout"
          toastMessage="Payout requested"
        />
      </PageHeader>

      <StatGrid stats={financeStats} className="sm:grid-cols-3 lg:grid-cols-6" />

      <Tabs defaultValue="revenue">
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <SectionCard
            title="Revenue by Property"
            description="Year-to-date performance across all 5 properties"
            action={
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/extranet/finance/revenue" />}
              >
                View detailed tracking
                <ArrowRight className="size-4" />
              </Button>
            }
            contentClassName="px-0"
          >
            <Table className={cellPad}>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead className="text-right">Revenue YTD</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">ADR</TableHead>
                  <TableHead className="text-right">RevPAR</TableHead>
                  <TableHead className="text-right">Occ.</TableHead>
                  <TableHead className="text-right">Growth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueByProperty.map((r) => (
                  <TableRow key={r.property}>
                    <TableCell className="font-medium">{r.property}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.city}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(r.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(r.bookings)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(r.adr)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(r.revpar)}
                    </TableCell>
                    <TableCell className="text-right">{r.occupancy}%</TableCell>
                    <TableCell className="text-right">
                      <DeltaBadge
                        delta={`+${r.growth}%`}
                        trend="up"
                        className="justify-end"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="commissions">
          <TabSummary
            note="Commissions paid YTD total $528,912 at an average rate of 12.4%. View monthly commission breakdowns per property."
            href="/extranet/finance/commissions"
            label="View Commission Reports"
          />
        </TabsContent>
        <TabsContent value="payouts">
          <TabSummary
            note="Pending payouts total $342,880 across all properties. Track payout status, methods and history."
            href="/extranet/finance/payouts"
            label="View Payouts"
          />
        </TabsContent>
        <TabsContent value="invoices">
          <TabSummary
            note="Outstanding invoices total $184,320. View, track and manage commission invoices."
            href="/extranet/finance/invoices"
            label="View Invoices"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
