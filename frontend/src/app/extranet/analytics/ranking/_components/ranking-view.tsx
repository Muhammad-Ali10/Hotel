"use client"

import Link from "next/link"

import { usePropertyRanking } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { SectionCard } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NotFoundCard } from "@/components/shared/not-found-card"

/** Where a partner goes to move each factor. */
const FIX: Record<string, { href: string; cta: string } | undefined> = {
  quality: { href: "/extranet/property/score", cta: "Improve the listing" },
  rating: { href: "/extranet/reviews", cta: "Reply to reviews" },
  conversion: { href: "/extranet/rates/calendar", cta: "Review your rates" },
  price: { href: "/extranet/analytics/comparables", cta: "Compare your market" },
  availability: { href: "/extranet/rates/open-close", cta: "Open more dates" },
}

/**
 * Where this listing sits in search, and why (rule #104).
 *
 * Every factor is published with its weight and its contribution, because a
 * ranking a partner cannot check is one they argue with — and "improve your
 * visibility" with no numbers behind it is the least actionable sentence a
 * marketplace can print.
 *
 * Two things here are deliberately not smoothed over:
 *
 *   - **the position and the factors can disagree by a day.** The position is
 *     last night's materialised sort; the factors are computed now. Presenting
 *     them as one snapshot would be the lie.
 *   - **a small sample says almost nothing.** A listing with three
 *     impressions and one click does not convert at 33%; the rate is pulled
 *     toward the market average in proportion to how little evidence there is,
 *     so a new listing is not flattered and an established one is not punished
 *     for a quiet week.
 */
export function RankingView() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const ranking = usePropertyRanking(active?.id ?? "")

  if (loadingProperties || ranking.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="bg-muted h-28 animate-pulse rounded-xl" />
        <div className="bg-muted h-64 animate-pulse rounded-xl" />
      </div>
    )
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="A ranking answers for one property at a time."
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

  const d = ranking.data
  const factors = d?.factors ?? []

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-1">
            <p className="text-muted-foreground text-sm">Ranking score</p>
            <p className="font-heading text-3xl font-semibold">
              {((d?.score ?? 0) / 100).toFixed(1)}
              <span className="text-muted-foreground text-base font-normal"> / 100</span>
            </p>
            <p className="text-muted-foreground text-xs">Computed now.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1">
            <p className="text-muted-foreground text-sm">Position in {d?.city}</p>
            <p className="font-heading text-3xl font-semibold">
              {d?.position === null || d === undefined ? (
                "—"
              ) : (
                <>
                  #{d.position}
                  <span className="text-muted-foreground text-base font-normal">
                    {" "}
                    of {d.total}
                  </span>
                </>
              )}
            </p>
            <p className="text-muted-foreground text-xs">
              {/*
               * Said out loud rather than hidden.
               *
               * The sort really is last night's and the reasons really are
               * today's; a partner who fixes something this morning and sees
               * the position unchanged deserves to know why.
               */}
              From last night&apos;s sort — the factors below are today&apos;s.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1">
            <p className="text-muted-foreground text-sm">Worth fixing first</p>
            <p className="font-heading text-xl font-semibold">
              {d?.weakest?.label ?? "—"}
            </p>
            <p className="text-muted-foreground text-xs">
              {d?.weakest
                ? `Scoring ${d.weakest.score.toFixed(0)} against a weight of ${d.weakest.weight}.`
                : "No ranking yet."}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Every factor, and what it is worth
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          {factors.map((factor) => {
            const fix = FIX[factor.key]
            return (
              <Card key={factor.key}>
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-heading text-base font-semibold">
                      {factor.label}
                    </h3>
                    <Badge variant="secondary">
                      {factor.contribution.toFixed(1)} of {factor.weight} pts
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-foreground h-full rounded-full"
                        style={{ width: `${factor.score}%` }}
                      />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Scoring {factor.score.toFixed(0)} / 100
                    </p>
                  </div>

                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {factor.detail}
                  </p>

                  {fix ? (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={fix.href}>{fix.cta}</Link>}
                    />
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {factors.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground text-sm">
              No ranking yet — this property needs to have been shown in search at
              least once.
            </CardContent>
          </Card>
        ) : null}
      </div>

      <SectionCard
        title="Why a new listing does not shoot to the top"
        description="Small samples are pulled toward the market average."
      >
        <p className="text-muted-foreground text-sm">
          A listing with three impressions and one click has not proved it converts at
          33%. Rates with little evidence behind them are pulled toward the market
          average in proportion to how little there is — so a quiet week does not
          punish an established property, and a lucky first day does not promote a new
          one over it.
        </p>
      </SectionCard>
    </div>
  )
}
