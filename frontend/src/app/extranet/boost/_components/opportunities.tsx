"use client"

import Link from "next/link"

import { usePropertyRanking } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NotFoundCard } from "@/components/shared/not-found-card"

/**
 * What is actually costing this listing visibility (rule #104).
 *
 * This page used to list eight "opportunities" from a fixed block of data —
 * the same eight for every property, with a Take Action button that toasted.
 * They were not opportunities; they were copy.
 *
 * A real one is a ranking factor scoring below what its weight is worth, and
 * the ranking module already computes every factor with the reason behind it.
 * Each one here links to the screen that can change it, because "improve your
 * visibility" with nowhere to click is the least actionable sentence a
 * marketplace can print.
 */

/** Where a partner goes to move each factor. */
const FIX: Record<string, { href: string; cta: string } | undefined> = {
  quality: { href: "/extranet/property/score", cta: "Improve the listing" },
  rating: { href: "/extranet/reviews", cta: "Reply to reviews" },
  conversion: { href: "/extranet/rates/calendar", cta: "Review your rates" },
  price: { href: "/extranet/analytics/comparables", cta: "Compare your market" },
  availability: { href: "/extranet/rates/open-close", cta: "Open more dates" },
}

export function Opportunities() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const ranking = usePropertyRanking(active?.id ?? "")

  if (loadingProperties || ranking.isPending) {
    return (
      <div className="grid gap-6 sm:grid-cols-2" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="bg-muted h-40 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to see what is holding it back."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  if (ranking.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {ranking.error.message}
      </div>
    )
  }

  const factors = ranking.data?.factors ?? []

  /*
   * Worst first, by what the score actually loses.
   *
   * A factor at 40 carrying a weight of 25 costs more than one at 20 carrying
   * 5, so sorting on the raw score alone would put the cheap fix at the top.
   */
  const ordered = [...factors].sort(
    (a, b) => (a.score - 100) * a.weight - (b.score - 100) * b.weight
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Ranking score</p>
            <p className="font-heading text-2xl font-semibold">
              {((ranking.data?.score ?? 0) / 100).toFixed(1)}
              <span className="text-muted-foreground text-base font-normal"> / 100</span>
            </p>
          </div>
          {ranking.data?.position !== null && ranking.data?.total ? (
            <div className="text-right">
              <p className="text-muted-foreground text-sm">In {ranking.data.city}</p>
              <p className="font-heading text-2xl font-semibold">
                #{ranking.data.position}
                <span className="text-muted-foreground text-base font-normal">
                  {" "}
                  of {ranking.data.total}
                </span>
              </p>
            </div>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/extranet/analytics/ranking">See the full breakdown</Link>}
          />
        </CardContent>
      </Card>

      <h2 className="font-heading text-lg font-semibold tracking-tight">
        What is costing you the most
      </h2>

      <div className="grid gap-6 sm:grid-cols-2">
        {ordered.map((factor) => {
          const fix = FIX[factor.key]
          const lost = ((100 - factor.score) * factor.weight) / 100
          return (
            <Card key={factor.key}>
              <CardContent className="flex h-full flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-heading text-base font-semibold">
                    {factor.label}
                  </h3>
                  <Badge variant={lost >= 8 ? "default" : "secondary"}>
                    −{lost.toFixed(1)} pts
                  </Badge>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Scoring {factor.score.toFixed(0)} / 100
                    </span>
                    <span className="text-muted-foreground">
                      worth {factor.weight} pts
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-foreground h-full rounded-full"
                      style={{ width: `${factor.score}%` }}
                    />
                  </div>
                </div>

                <p className="text-muted-foreground text-sm leading-relaxed">
                  {factor.detail}
                </p>

                {fix ? (
                  <div className="mt-auto pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={fix.href}>{fix.cta}</Link>}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {ordered.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground text-sm">
            No ranking yet for this property — it needs to have been shown in search
            at least once.
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
