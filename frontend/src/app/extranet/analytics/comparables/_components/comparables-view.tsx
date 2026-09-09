"use client"

import { formatCurrency } from "@/lib/format"
import { useComparables } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import {
  AnalyticsRangeBar,
  money,
  useAnalyticsRange,
} from "@/components/extranet/analytics-range"
import { SectionCard } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { NotFoundCard } from "@/components/shared/not-found-card"

/**
 * How this property sits against its city (rule #65).
 *
 * Everything about this screen is shaped by one constraint: a market average
 * over a handful of properties is one subtraction away from a competitor's
 * exact rate. So when too few properties contribute, the API publishes nothing
 * at all — `suppressed`, every market figure `null` together — rather than
 * publishing a number that leaks.
 *
 * That is a real answer, not a failure, and the screen says so in those words.
 * A blank chart with no explanation is how a partner concludes the product is
 * broken and stops trusting the numbers that are there.
 */
export function ComparablesView() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const { range, controls } = useAnalyticsRange(90)
  const data = useComparables({ ...range, propertyId: active?.id ?? "" })

  if (loadingProperties) {
    return <div className="bg-muted h-64 animate-pulse rounded-xl" aria-busy="true" />
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="Comparables answer for one property — a portfolio has no single market."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const d = data.data

  return (
    <div className="space-y-6">
      <AnalyticsRangeBar controls={controls} />

      {data.isPending ? (
        <div className="bg-muted h-64 animate-pulse rounded-xl" aria-busy="true" />
      ) : data.error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
          {data.error.message}
        </div>
      ) : d?.suppressed ? (
        <Card>
          <CardContent className="space-y-2">
            <h2 className="font-heading text-base font-semibold">
              Not enough of {d.city} to compare against
            </h2>
            <p className="text-muted-foreground text-sm">
              Only {d.sample} {d.sample === 1 ? "property" : "properties"} contributed
              in this window. An average over that few is one subtraction away from a
              named competitor&apos;s exact rate, so nothing is published rather than
              something that leaks. Widening the date range usually helps.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{d?.city}</Badge>
            <span className="text-muted-foreground text-sm">
              against {d?.sample} properties
            </span>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            <CompareCard
              title="Average daily rate"
              mine={money(d?.mine.adr ?? null, formatCurrency)}
              market={money(d?.market.adr ?? null, formatCurrency)}
              versus={d?.versus.adr ?? null}
            />
            <CompareCard
              title="Occupancy"
              mine={`${((d?.mine.occupancy ?? 0) * 100).toFixed(0)}%`}
              market={
                d?.market.occupancy === null || d === undefined
                  ? "—"
                  : `${(d.market.occupancy * 100).toFixed(0)}%`
              }
              versus={d?.versus.occupancy ?? null}
            />
            <CompareCard
              title="Review score"
              mine={d?.mine.score === null || d === undefined ? "—" : d.mine.score.toFixed(1)}
              market={
                d?.market.score === null || d === undefined ? "—" : d.market.score.toFixed(1)
              }
              versus={d?.versus.score ?? null}
            />
          </div>

          <SectionCard
            title="Reading this"
            description="Ahead of the market is not automatically good."
          >
            <p className="text-muted-foreground text-sm">
              A rate well above the market with occupancy well below it is a price the
              city is not paying. The reverse — full every night at a rate below
              everyone — is money left on the table. The pair is the signal; neither
              number means much alone.
            </p>
          </SectionCard>
        </>
      )}
    </div>
  )
}

function CompareCard({
  title,
  mine,
  market,
  versus,
}: {
  title: string
  mine: string
  market: string
  /** A fraction: `0.08` is "8% above market". `null` when there is nothing to compare. */
  versus: number | null
}) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <h3 className="font-heading text-sm font-semibold">{title}</h3>
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-muted-foreground text-xs">You</p>
            <p className="font-heading text-2xl font-semibold">{mine}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground text-xs">Market</p>
            <p className="font-heading text-lg font-medium">{market}</p>
          </div>
        </div>
        {versus === null ? (
          <p className="text-muted-foreground text-xs">Nothing to compare against.</p>
        ) : (
          <Badge variant={Math.abs(versus) < 0.05 ? "secondary" : "outline"}>
            {versus >= 0 ? "+" : ""}
            {(versus * 100).toFixed(0)}% vs market
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}
