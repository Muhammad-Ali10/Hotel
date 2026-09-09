"use client"

import Link from "next/link"

import type { Stat } from "@/lib/extranet/types"
import { formatCurrency } from "@/lib/format"
import { useGeniusAnalytics } from "@/lib/api/hooks"
import {
  AnalyticsRangeBar,
  money,
  useAnalyticsRange,
} from "@/components/extranet/analytics-range"
import { SectionCard, StatGrid } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"

/**
 * What the Genius tier actually bought.
 *
 * The one number worth arguing with is the last one: what the discount gave
 * away, against what those bookings earned. A tier that brings guests who
 * would have booked anyway is a discount on revenue you already had, and this
 * is the only screen that can show it — the two ADRs side by side.
 *
 * Genius is read from the signed-in ACCOUNT, unlike the mobile channel which
 * is read from the browser (rule #3). So these bookings really did come from
 * members; nothing here can have been spoofed into the count.
 */
export function GeniusView() {
  const { range, controls } = useAnalyticsRange(90)
  const data = useGeniusAnalytics(range)
  const d = data.data

  const stats: Stat[] = [
    {
      label: "Genius bookings",
      value: d ? String(d.bookings) : "—",
      caption: d ? `of ${d.totalBookings} in total` : undefined,
    },
    {
      label: "Share",
      value: d ? `${(d.share * 100).toFixed(1)}%` : "—",
      caption: "of bookings in the window",
    },
    {
      label: "Revenue",
      value: d ? money(d.revenue, formatCurrency) : "—",
      caption: "gross, from members",
    },
    {
      label: "Members",
      value: d ? String(d.guests) : "—",
      caption: "distinct guests",
    },
    {
      label: "Genius ADR",
      value: d ? money(d.adr, formatCurrency) : "—",
    },
    {
      label: "Everyone else",
      value: d ? money(d.nonGeniusAdr, formatCurrency) : "—",
      caption: "the comparison that matters",
    },
  ]

  return (
    <div className="space-y-6">
      <AnalyticsRangeBar controls={controls} />

      {data.isPending ? (
        <div className="bg-muted h-64 animate-pulse rounded-xl" aria-busy="true" />
      ) : data.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {data.error.message}
        </div>
      ) : (
        <>
          <StatGrid stats={stats} className="sm:grid-cols-3 lg:grid-cols-6" />

          <SectionCard
            title="What the tier cost you"
            description="The discount given away over the window."
          >
            <p className="font-heading text-3xl font-semibold">
              {d ? money(d.discountGiven, formatCurrency) : "—"}
            </p>
            <p className="text-muted-foreground text-sm">
              {d && d.adr !== null && d.nonGeniusAdr !== null && d.bookings > 0
                ? d.adr < d.nonGeniusAdr
                  ? `Members paid ${formatCurrency((d.nonGeniusAdr - d.adr))} less a night than everyone else. Worth it only if they would not otherwise have booked.`
                  : "Members paid at least as much a night as everyone else — the tier is bringing demand, not just discounting it."
                : "Not enough Genius bookings in this window to compare."}
            </p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/extranet/boost/genius">Manage Genius deals</Link>}
              />
            </div>
          </SectionCard>
        </>
      )}
    </div>
  )
}
