"use client"

import Link from "next/link"
import Image from "next/image"
import { BadgeCheck, MessageSquare, PenLine } from "lucide-react"

import type { Review } from "@/types"
import { REVIEW_CATEGORIES } from "@/types"
import { avatarImage } from "@/lib/images"
import { formatDate, formatNumber } from "@/lib/format"
import { useHotelRating, useHotelReviews } from "@/store/selectors"
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

export function HotelReviews({ hotelId, hotelName }: { hotelId: string; hotelName: string }) {
  const reviews = useHotelReviews(hotelId)
  // Headline score and category bars are averaged from the reviews below — the
  // page used to print a hardcoded 4.9 over an unrelated list of three.
  const { rating, reviewCount, categories } = useHotelRating(hotelId)

  return (
    <section id="reviews" className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold">Guest Reviews</h2>
        <Button
          variant="outline"
          size="sm"
          render={
            <Link href={`/dashboard/reviews?hotel=${hotelId}`}>
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
                {REVIEW_CATEGORIES.map(({ key, label }) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{categories[key].toFixed(1)}</span>
                    </div>
                    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className="bg-primary h-full rounded-full"
                        style={{ width: `${(categories[key] / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 space-y-4">
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} hotelName={hotelName} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function ReviewCard({ review, hotelName }: { review: Review; hotelName: string }) {
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
                {review.bookingId ? (
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
            <p className="text-muted-foreground text-xs">{formatDate(review.response.date)}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
