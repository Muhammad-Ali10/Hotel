"use client"

import Link from "next/link"
import { ChevronLeft, ExternalLink, Lightbulb } from "lucide-react"

import { useActiveHotel, useAllHotelReviews, useHotelRating } from "@/store/selectors"
import { PageHeader, StatusPill } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NotFoundCard } from "@/components/shared/not-found-card"

type Tone = "success" | "warning" | "danger"

function tone(score: number): Tone {
  if (score >= 85) return "success"
  if (score >= 70) return "warning"
  return "danger"
}

function label(score: number) {
  if (score >= 85) return "Excellent"
  if (score >= 70) return "Good"
  return "Needs Work"
}

/**
 * A page-completeness score, computed from the listing itself. Every figure and
 * tip is derived — the page used to hardcode "Average rating 4.2/5" and
 * "4 pending reviews" while the Reviews screen, reading the same portfolio,
 * showed 4.3 and 3.
 *
 * The /100 here scores the *listing*, not the guests' opinion of the hotel;
 * the guest rating is /5 like everywhere else.
 */
export function ScoreView() {
  const hotel = useActiveHotel()
  const allReviews = useAllHotelReviews(hotel?.id ?? "")
  const rating = useHotelRating(hotel?.id ?? "")

  if (!hotel) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to see its page score."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const pending = allReviews.filter((r) => r.status === "pending").length
  const published = allReviews.filter((r) => r.status === "published")
  const awaitingReply = published.filter((r) => !r.response).length
  const activeValueAdds = hotel.valueAdds.filter((v) => v.active).length

  const categories = [
    {
      name: "Photos & Media",
      score: Math.min(100, hotel.photos.length * 12),
      tip:
        hotel.photos.length >= 8
          ? "Your gallery is well covered."
          : `Add ${8 - hotel.photos.length} more photos — listings with 8+ convert better.`,
    },
    {
      name: "Description Quality",
      score: Math.min(100, Math.round((hotel.description.length / 400) * 100)),
      tip:
        hotel.description.length >= 320
          ? "Your description gives guests enough to picture the stay."
          : "Write at least a short paragraph describing the property.",
    },
    {
      name: "Room Information",
      score: Math.min(100, hotel.rooms.length * 18),
      tip: `${hotel.rooms.length} room types listed with rates, sizes and features.`,
    },
    {
      name: "Amenities Listed",
      score: Math.min(100, hotel.amenities.length * 13),
      tip:
        hotel.amenities.length >= 7
          ? "Good coverage of what you offer."
          : "List more amenities — guests filter on them.",
    },
    {
      name: "Review Score",
      score: rating.reviewCount ? Math.round((rating.rating / 5) * 100) : 0,
      tip: rating.reviewCount
        ? `Average rating ${rating.rating}/5 across ${rating.reviewCount} published ${
            rating.reviewCount === 1 ? "review" : "reviews"
          }.`
        : "No published reviews yet.",
    },
    {
      name: "Response Rate",
      score: published.length
        ? Math.round(((published.length - awaitingReply) / published.length) * 100)
        : 100,
      tip: awaitingReply
        ? `Respond to ${awaitingReply} ${awaitingReply === 1 ? "review" : "reviews"} awaiting a reply.`
        : "Every published review has a response.",
    },
    {
      name: "Policies & Extras",
      score: Math.min(100, 60 + activeValueAdds * 8),
      tip: `${activeValueAdds} value-add${activeValueAdds === 1 ? "" : "s"} offered at checkout.`,
    },
  ]

  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Property Page Score"
        subtitle={`How complete your ${hotel.name} listing is`}
      >
        <Button
          variant="outline"
          size="sm"
          render={
            <Link href={`/hotels/${hotel.id}`} target="_blank">
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
              {overall}
              <span className="text-muted-foreground text-2xl">/100</span>
            </p>
            <div className="mt-2 flex items-center justify-center gap-2 sm:justify-start">
              <span className="text-sm">Page completeness:</span>
              <StatusPill status={label(overall)} tone={tone(overall)} />
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-muted-foreground text-sm">
              This measures how complete your listing is — photos, description, rooms,
              amenities and how quickly you reply. It is not the guest rating, which is{" "}
              <span className="text-foreground font-medium">
                {rating.reviewCount ? `${rating.rating}/5` : "not yet rated"}
              </span>
              .
            </p>
            {pending > 0 ? (
              <p className="flex items-center gap-1.5 text-sm">
                <Lightbulb className="size-3.5" />
                {pending} {pending === 1 ? "review is" : "reviews are"} waiting on moderation.{" "}
                <Link href="/extranet/reviews" className="text-primary hover:underline">
                  Review now
                </Link>
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {categories.map((c) => (
          <Card key={c.name}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-heading text-sm font-semibold">{c.name}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.score}/100</span>
                  <StatusPill status={label(c.score)} tone={tone(c.score)} />
                </div>
              </div>
              <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className="bg-foreground h-full rounded-full"
                  style={{ width: `${c.score}%` }}
                />
              </div>
              <p className="text-muted-foreground flex items-start gap-1.5 text-sm">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
                {c.tip}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
