import Link from "next/link"
import { ChevronLeft, Download } from "lucide-react"

import type { Stat } from "@/lib/extranet/types"
import { commissionReports, commissionStats } from "@/data/extranet"
import { formatCurrency, formatNumber } from "@/lib/format"
import {
  ActionButton,
  PageHeader,
  StatGrid,
  StatusPill,
} from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

const stats: Stat[] = [
  { label: "Gross Revenue", value: formatCurrency(commissionStats.gross) },
  {
    label: "Total Commission",
    value: formatCurrency(commissionStats.commission),
  },
  { label: "Net to Owner", value: formatCurrency(commissionStats.netToOwner) },
  { label: "Total Bookings", value: formatNumber(commissionStats.bookings) },
]

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

export default function CommissionReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Commission Reports"
        subtitle="Monthly commission breakdowns for each property"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/finance" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
        <ActionButton
          size="sm"
          toastType="info"
          toastMessage="Downloading commission report…"
        >
          <Download className="size-4" />
          Download Report
        </ActionButton>
      </PageHeader>

      <StatGrid stats={stats} className="lg:grid-cols-4" />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {commissionReports.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading text-sm font-semibold">
                    {r.property}
                  </h3>
                  <p className="text-muted-foreground text-xs">{r.month}</p>
                </div>
                <StatusPill status={r.status} />
              </div>
              <div className="space-y-2 border-t pt-3 text-sm">
                <Row label="Gross Revenue" value={formatCurrency(r.grossRevenue)} />
                <Row label="Rate" value={`${r.rate}%`} />
                <Row label="Commission" value={formatCurrency(r.commission)} />
                <Row label="Net to Owner" value={formatCurrency(r.netToOwner)} />
                <Row label="Bookings" value={formatNumber(r.bookings)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
