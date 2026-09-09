"use client"

import type { Stat } from "@/lib/extranet/types"
import { cellPad } from "@/lib/extranet/constants"
import { formatCurrency } from "@/lib/format"
import { useCancellations } from "@/lib/api/hooks"
import {
  AnalyticsRangeBar,
  money,
  useAnalyticsRange,
} from "@/components/extranet/analytics-range"
import { SectionCard, StatGrid } from "@/components/extranet/shared"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/** `guest` / `partner` / `system` read as sentences, not as column values. */
const ACTOR_LABEL: Record<string, string> = {
  guest: "The guest cancelled",
  partner: "You cancelled",
  admin: "The platform cancelled",
  system: "A hold lapsed",
}

/**
 * Who cancelled, why, and what it cost.
 *
 * Two numbers here look like they should cancel out and must not: the fee
 * CHARGED is yours, the amount REFUNDED went back to the guest, and netting
 * one off the other would hide a month where you charged nothing and refunded
 * everything (rule #63).
 *
 * "By actor" is the question this screen exists to answer. A guest cancelling
 * inside their own terms is the cost of doing business; a property cancelling
 * a confirmed stay is a different event entirely, and lumping them together as
 * a single "cancellation rate" is how a real problem stays invisible.
 */
export function CancellationsView() {
  const { range, controls } = useAnalyticsRange(90)
  const data = useCancellations(range)

  const d = data.data

  const stats: Stat[] = [
    { label: "Cancelled", value: d ? String(d.total) : "—" },
    {
      label: "Cancellation rate",
      value: d ? `${(d.rate * 100).toFixed(1)}%` : "—",
      caption: "of bookings made in the window",
    },
    { label: "No-shows", value: d ? String(d.noShows) : "—" },
    {
      label: "Average notice",
      value: d?.avgDaysBefore === null || d === undefined
        ? "—"
        : `${d.avgDaysBefore.toFixed(1)} days`,
      caption: "before check-in",
    },
    {
      label: "Fees charged",
      value: d ? money(d.feesCharged, formatCurrency) : "—",
      caption: "kept, no room sold",
    },
    {
      label: "Refunded",
      value: d ? money(d.refunded, formatCurrency) : "—",
      caption: "returned to guests",
    },
  ]

  return (
    <div className="space-y-6">
      <AnalyticsRangeBar controls={controls} />

      {data.isPending ? (
        <div className="bg-muted h-72 animate-pulse rounded-xl" aria-busy="true" />
      ) : data.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {data.error.message}
        </div>
      ) : (
        <>
          <StatGrid stats={stats} className="sm:grid-cols-3 lg:grid-cols-6" />

          <SectionCard
            title="Who cancelled"
            description="A guest cancelling within their terms and a property cancelling a confirmed stay are not the same event."
          >
            {(d?.byActor.length ?? 0) === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                Nothing was cancelled in this window.
              </p>
            ) : (
              <ul className="divide-y">
                {(d?.byActor ?? []).map((row) => (
                  <li
                    key={row.actor}
                    className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm">{ACTOR_LABEL[row.actor] ?? row.actor}</span>
                    <span className="text-sm font-medium">{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <div className="space-y-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              By reason
            </h2>
            <Card className="py-0">
              <div className="overflow-x-auto">
                <Table className={cellPad}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">Share</TableHead>
                      <TableHead className="text-right">Average notice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(d?.byReason ?? []).map((row) => (
                      <TableRow key={row.reason}>
                        <TableCell className="font-medium">{row.reason}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right">
                          {(row.share * 100).toFixed(0)}%
                        </TableCell>
                        <TableCell className="text-right">
                          {row.avgDaysBefore === null
                            ? "—"
                            : `${row.avgDaysBefore.toFixed(1)} days`}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(d?.byReason.length ?? 0) === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-muted-foreground py-8 text-center"
                        >
                          No reasons recorded in this window.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
