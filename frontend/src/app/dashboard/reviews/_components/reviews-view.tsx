"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSearchParams } from "next/navigation"
import { MessageSquare, PenLine, Star, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { REVIEW_CATEGORIES } from "@/types"
import { placeholderImage } from "@/lib/images"
import { formatDate } from "@/lib/format"
import type { ReviewDto, ReviewableBooking } from "@/lib/api/endpoints"
import { useDeleteReview, useMyReviews, useReviewableBookings } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StarRating } from "@/components/marketplace/star-rating"
import { WriteReviewDialog } from "./write-review-dialog"

export function ReviewsView() {
  const params = useSearchParams()
  const reviews = useMyReviews()
  const reviewableQuery = useReviewableBookings()
  const remove = useDeleteReview()

  const myReviews = reviews.data?.items ?? []
  const reviewable = reviewableQuery.data ?? []

  const [picked, setPicked] = React.useState<ReviewableBooking | null>(null)
  const [dismissedDeepLink, setDismissedDeepLink] = React.useState(false)

  // Deep links from a booking card (?booking=STY-…) and from a hotel page
  // (?hotel=…, which resolves to that hotel's reviewable stay). Derived rather
  // than pushed into state by an effect, so the dialog opens on the first
  // render instead of a second one.
  const bookingParam = params.get("booking")
  const hotelParam = params.get("hotel")
  const deepLinked = dismissedDeepLink
    ? null
    : (bookingParam
        ? (reviewable.find((b) => b.id === bookingParam) ?? null)
        : hotelParam
          ? (reviewable.find((b) => b.propertyId === hotelParam) ?? null)
          : null)
  const writing = picked ?? deepLinked

  /*
   * A hotel-page link for a stay the guest never had would otherwise land on a
   * silent page. The hotel is NOT named: doing so would mean fetching the
   * whole catalogue to render one sentence about a property they have no
   * booking at.
   */
  const nothingToReview = Boolean(hotelParam) && !deepLinked && !picked

  function closeDialog() {
    setPicked(null)
    setDismissedDeepLink(true)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          My Reviews
        </h1>
      </div>

      {nothingToReview ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          You can review a hotel once you&apos;ve completed a stay there.
        </div>
      ) : null}

      {/* Stays you can review — the entry point that never existed */}
      {reviewable.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">Awaiting your review</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {reviewable.map((booking) => (
              <Card key={booking.id}>
                <CardContent className="flex items-center gap-3">
                  <div className="relative size-12 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={placeholderImage(booking.propertyId, 120, 120)}
                      alt={booking.propertyName}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{booking.propertyName}</p>
                    <p className="text-muted-foreground text-sm">
                      Stayed {formatDate(booking.checkOut)}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => setPicked(booking)}>
                    <PenLine className="size-3.5" />
                    Review
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}

      {/* Reviews written */}
      <section className="space-y-3">
        {reviewable.length > 0 ? (
          <h2 className="font-heading text-lg font-semibold">Published</h2>
        ) : null}

        {myReviews.length === 0 ? (
          <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <Star className="text-muted-foreground size-8" />
            <div className="space-y-1">
              <p className="font-medium">No reviews yet</p>
              <p className="text-muted-foreground text-sm">
                Once you complete a stay you can share how it went.
              </p>
            </div>
            <Button size="sm" render={<Link href="/dashboard/bookings">View my bookings</Link>} />
          </div>
        ) : (
          <div className="space-y-4">
            {myReviews.map((review) => (
              <MyReviewCard
                key={review.id}
                review={review}
                onDelete={() =>
                  remove.mutate(review.id, {
                    onSuccess: () => toast.success("Review deleted."),
                    onError: (e) => toast.error(e.message),
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      {writing ? (
        <WriteReviewDialog
          booking={writing}
          open={Boolean(writing)}
          onOpenChange={(open) => !open && closeDialog()}
        />
      ) : null}
    </div>
  )
}

function MyReviewCard({ review, onDelete }: { review: ReviewDto; onDelete: () => void }) {
  // The name is joined by the API on a guest's own list; the id is the seed.
  const hotelName = review.propertyName || "This property"
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg">
          <Image
            src={placeholderImage(review.propertyId, 160, 160)}
            alt={hotelName}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0 space-y-1">
              <Link
                href={`/hotels/${review.propertyId}`}
                className="font-heading text-base font-semibold hover:underline"
              >
                {hotelName}
              </Link>
              <p className="text-muted-foreground text-sm">
                Stayed in {review.roomName} · Reviewed {formatDate(review.date)}
              </p>
            </div>

            {/* One scale, /5 — this card used to show stars and a fabricated
                "/10" score derived by doubling the same value. */}
            <div className="flex shrink-0 items-center gap-2">
              <StarRating rating={review.rating} />
              <span className="text-sm font-medium">{review.rating}</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="font-medium">{review.title}</p>
            <p className="text-muted-foreground text-sm text-pretty">{review.body}</p>
          </div>

          <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {REVIEW_CATEGORIES.map(({ key, label }) => (
              <span key={key}>
                {label} <span className="text-foreground font-medium">{review.categories[key]}</span>
              </span>
            ))}
          </div>

          {/* The hotel's reply — written in the extranet, and until now visible
              only there. */}
          {review.response ? (
            <div className="bg-muted/40 border-l-primary/40 space-y-1 rounded-lg border-l-2 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <MessageSquare className="size-3.5" />
                Response from {hotelName}
              </p>
              <p className="text-muted-foreground text-sm text-pretty">{review.response.text}</p>
              <p className="text-muted-foreground text-xs">{review.response.at ? formatDate(review.response.at) : null}</p>
            </div>
          ) : null}

          <Button variant="ghost" size="sm" className="-ml-2" onClick={onDelete}>
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
