"use client"

import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency, formatDate } from "@/lib/format"
import { usePayoutAccount, usePayouts } from "@/lib/api/hooks"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_TONE: Record<string, string> = {
  paid: "bg-primary text-primary-foreground",
  pending: "bg-muted text-muted-foreground",
  processing: "bg-primary/10 text-primary",
  failed: "bg-destructive/10 text-destructive",
  held: "bg-muted text-muted-foreground",
}

/**
 * Settlements, signed (rule #52).
 *
 * `net` can be negative, and the screen has to say so in words rather than
 * showing a smaller positive number. A month whose refunds outweighed its
 * takings leaves the property owing the platform, and `carryIn` is what a
 * previous period could not settle and pushed forward.
 *
 * A failed payout shows its reason. "Payout failed" with no cause is a support
 * ticket; "the account details were rejected by the bank" is something a
 * partner can act on this afternoon.
 */
export function PayoutsView() {
  const payouts = usePayouts()
  const account = usePayoutAccount()

  const list = payouts.data ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-2">
          <h3 className="font-heading text-sm font-semibold">Where the money goes</h3>
          {account.isPending ? (
            <div className="bg-muted h-6 w-56 animate-pulse rounded" aria-busy="true" />
          ) : account.data === null || account.data === undefined ? (
            <p className="text-muted-foreground text-sm">
              No payout account yet. Nothing can be settled until one is on file —
              only an organisation admin may add it, because re-pointing a payout
              account is how a compromised login becomes a bank transfer.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm">
                {account.data.holderName} · {account.data.bankName} ····
                {account.data.last4}
              </p>
              <Badge variant={account.data.status === "verified" ? "secondary" : "outline"}>
                {account.data.status}
              </Badge>
              <span className="text-muted-foreground text-sm">
                {account.data.currency}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {payouts.isPending ? (
        <div className="bg-muted h-64 animate-pulse rounded-xl" aria-busy="true" />
      ) : payouts.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {payouts.error.message}
        </div>
      ) : (
        <Card className="py-0">
          <div className="overflow-x-auto">
            <Table className={cellPad}>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Carried in</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell className="font-medium">
                      {formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(payout.gross)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(payout.commission)}
                    </TableCell>
                    <TableCell className="text-right">
                      {payout.carryIn === 0 ? "—" : formatCurrency(payout.carryIn)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {payout.net < 0 ? (
                        <span className="text-destructive">
                          {formatCurrency(Math.abs(payout.net))} owed back
                        </span>
                      ) : (
                        formatCurrency(payout.net)
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge className={STATUS_TONE[payout.status] ?? ""}>
                          {payout.status}
                        </Badge>
                        {payout.paidAt ? (
                          <p className="text-muted-foreground text-xs">
                            {formatDate(payout.paidAt)}
                          </p>
                        ) : null}
                        {payout.failureReason ? (
                          <p className="text-destructive text-xs">
                            {payout.failureReason}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                      No settlement yet. The first one is created once a stay has been
                      completed.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <p className="text-muted-foreground text-sm">
        A negative settlement means refunds outweighed takings for that period, so the
        balance is owed back rather than paid out. It carries into the next one rather
        than being written off.
      </p>
    </div>
  )
}
