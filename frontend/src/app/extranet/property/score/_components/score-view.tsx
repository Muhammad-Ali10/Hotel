"use client"

import Link from "next/link"
import { ChevronLeft, ExternalLink, Lightbulb } from "lucide-react"

import { useListingScore, usePerformance } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { toISODate } from "@/lib/domain"
import { PageHeader, StatusPill } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NotFoundCard } from "@/components/shared/not-found-card"

type Tone = "success" | "warning" | "danger"

/** The bands the API's own `scoreBand` draws (rule #99). */
function tone(score: number): Tone {
  if (score >= 85) return "success"
  if (score >= 60) return "warning"
  return "danger"
}

function label(score: number) {
  if (score >= 85) return "Excellent"
  if (score >= 60) return "Good"
  return "Needs Work"
}

/**
 * How well this listing page is built, out of 100 (rule #99).
 *
 * The score is the SERVER's — the same computation the platform's own content
 * screen runs. It used to be worked out here from a fixture, with weights
 * invented on this page: a partner improving the number they were shown would
 * have been improving a number the platform never looked at.
 *
 * The one thing that changed most: a listing with no reviews yet used to score
 * **zero** on its rating, dragging the total down for the one thing a new
 * property cannot act on. The API marks that category `applicable: false` and
 * renormalises the weights.
 */
export function ScoreView() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const score = useListingScore(active?.id ?? "")

  const today = toISODate(new Date())
  const performance = usePerformance({ from: today, to: today, propertyId: active?.id })
  const perf = performance.data?.[0]

  if (loadingProperties || score.isPending) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading score">
        <div className="bg-muted h-32 animate-pulse rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-32 animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!active || !score.data) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to see its page score."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const { total, categories } = score.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Property Page Score"
        subtitle={`How complete your ${score.data.name} listing is`}
      >
        <Button
          variant="outline"
          size="sm"
          render={
            <Link href={`/hotels/${active.slug}`} target="_blank">
              <ExternalLink className="size-4" />
              View listing
            </Link>
          }
        />
        <Button variant="outline" size="sm" render={<Link href="/extranet/property" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-2 sm:flex-row sm:items-center">
          <div className="text-center sm:text-left">
            <p className="font-heading text-5xl font-semibold">
              {total}
              <span className="text-muted-foreground text-2xl">/100</span>
            </p>
            <div className="mt-2 flex items-center justify-center gap-2 sm:justify-start">
              <span className="text-sm">Page completeness:</span>
              <StatusPill status={label(total)} tone={tone(total)} />
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-muted-foreground text-sm">
              This measures how complete your listing is — photos, description, rooms,
              amenities and how quickly you reply. It is not the guest rating, which is{" "}
              <span className="text-foreground font-medium">
                {perf?.reviews && perf.score !== null ? `${perf.score}/5` : "not yet rated"}
              </span>
              .
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((c) => (
          <Card key={c.key}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-heading text-sm font-semibold">{c.name}</p>
                <div className="flex items-center gap-2">
                  {/*
                    A category with nothing to measure yet says so instead of
                    showing a zero. "Guest rating: 0/100" on a listing nobody
                    has reviewed is a mark against a property for a thing it
                    cannot do anything about.
                  */}
                  {c.applicable && c.score !== null ? (
                    <>
                      <span className="text-sm font-medium">{c.score}/100</span>
                      <StatusPill status={label(c.score)} tone={tone(c.score)} />
                    </>
                  ) : (
                    <StatusPill status="Not yet" tone="neutral" />
                  )}
                </div>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-foreground h-full rounded-full"
                  style={{ width: `${c.applicable ? (c.score ?? 0) : 0}%` }}
                />
              </div>
              <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
                {c.tip}
              </p>
              <p className="text-muted-foreground text-xs">
                Worth {c.weight}% of the score
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
