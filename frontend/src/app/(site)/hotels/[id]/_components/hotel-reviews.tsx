"use client"

import Link from "next/link"
import Image from "next/image"
import { BadgeCheck, MessageSquare, PenLine } from "lucide-react"

import { REVIEW_CATEGORIES } from "@/types"
import { avatarImage } from "@/lib/images"
import { formatDate, formatNumber } from "@/lib/format"
import type { ReviewDto } from "@/lib/api/endpoints"
import { usePropertyReviews } from "@/lib/api/hooks"
import { Skeleton } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StarRating } from "@/components/marketplace/star-rating"

function ratingLabel(rating: number) {
  if (rating >= 4.8) return "Exceptional"
  if (rating >= 4.5) return "Excellent"
  if (rating >= 4) return "Very Good"
  if (rating >= 3) return "Good"
  return "Fair"
}

/**
 * A property's published reviews.
 *
 * The headline score and the category bars come from the SERVER, not from
 * averaging the reviews on this page. That distinction matters as soon as a
 * property has more reviews than one page holds: averaging twenty of sixty
 * would print a score that disagrees with the count printed beside it.
 *
 * Only `published` reviews are here at all — the endpoint is public and
 * filters at the query, so a pending or rejected one is not merely hidden by
 * this component, it never leaves the database.
 */
export function HotelReviews({ slug, hotelName }: { slug: string; hotelName: string }) {
  const { data, isPending, error } = usePropertyReviews(slug)

  const reviews = data?.items ?? []
  const rating = data?.rating.rating ?? 0
  const reviewCount = data?.rating.reviewCount ?? 0
  const categories = data?.rating.categories

  if (isPending) {
    return (
      <section id="reviews" className="scroll-mt-24" aria-busy="true">
        <h2 className="font-heading text-xl font-semibold">Guest Reviews</h2>
        <div className="mt-4 space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section id="reviews" className="scroll-mt-24">
        <h2 className="font-heading text-xl font-semibold">Guest Reviews</h2>
        <Card className="mt-4">
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            Reviews could not be loaded just now.
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <section id="reviews" className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold">Guest Reviews</h2>
        <Button
          variant="outline"
          size="sm"
          render={
            <Link href={`/dashboard/reviews?hotel=${slug}`}>
              <PenLine className="size-3.5" />
              Write a review
            </Link>
          }
        />
      </div>

      {reviewCount === 0 ? (
        <Card className="mt-4">
          <CardContent className="py-10 text-center">
            <p className="font-medium">No reviews yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Be the first to share your stay at {hotelName}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mt-4">
            <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
              <div className="flex flex-col items-center justify-center gap-1 sm:pr-6">
                <span className="font-heading text-4xl font-semibold">{rating}</span>
                <StarRating rating={rating} size="size-4" />
                <span className="text-sm font-medium">{ratingLabel(rating)}</span>
                <span className="text-muted-foreground text-xs">
                  {formatNumber(reviewCount)} {reviewCount === 1 ? "review" : "reviews"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {REVIEW_CATEGORIES.map(({ key, label }) => {
                  const score = categories?.[key] ?? 0
                  return (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{label}</span>
                        <span className="font-medium">{score.toFixed(1)}</span>
                      </div>
                      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${(score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 space-y-4">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} hotelName={hotelName} />
            ))}
          </div>

          {data?.nextCursor ? (
            <p className="text-muted-foreground mt-4 text-center text-sm">
              Showing the {reviews.length} most recent of{" "}
              {formatNumber(reviewCount)}.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

function ReviewCard({ review, hotelName }: { review: ReviewDto; hotelName: string }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <Image
              src={avatarImage(review.authorSeed, 80)}
              alt={review.author}
              width={36}
              height={36}
              className="size-9 rounded-full object-cover"
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-heading font-semibold">{review.author}</span>
                {/* Only a review tied to a real stay earns the badge */}
                {review.verified ? (
                  <Badge variant="secondary" className="gap-1">
                    <BadgeCheck className="size-3" />
                    Verified Guest
                  </Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">
                {review.country} · Stayed in {review.roomName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <StarRating rating={review.rating} size="size-3.5" />
            <span className="text-sm font-medium">{review.rating}</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="font-medium">{review.title}</p>
          <p className="text-muted-foreground text-sm text-pretty">{review.body}</p>
        </div>
        <p className="text-muted-foreground text-xs">{formatDate(review.date)}</p>

        {/* The partner's reply, written in the extranet — previously invisible
            to guests, which made replying pointless. */}
        {review.response ? (
          <div className="bg-muted/40 mt-2 space-y-1 rounded-lg border-l-2 border-l-primary/40 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <MessageSquare className="size-3.5" />
              Response from {hotelName}
            </p>
            <p className="text-muted-foreground text-sm text-pretty">{review.response.text}</p>
            {review.response.at ? (
              <p className="text-muted-foreground text-xs">
                {formatDate(review.response.at)}
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
