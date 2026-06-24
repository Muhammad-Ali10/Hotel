import Image from "next/image"

import type { UserReview } from "@/types"
import { placeholderImage } from "@/lib/images"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { StarRating } from "@/components/marketplace/star-rating"

/** Convert a 5-star rating into the /10 score shown in the design (e.g. 5 → 10.0). */
function toScore(rating: number) {
  return (rating * 2).toFixed(1)
}

export function ReviewCard({ review }: { review: UserReview }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg">
          <Image
            src={placeholderImage(review.seed, 160, 160)}
            alt={review.hotel}
            fill
            sizes="64px"
            className="object-cover"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0 space-y-1">
              <h3 className="font-heading text-base font-semibold">
                {review.hotel}
              </h3>
              <p className="text-muted-foreground text-sm">
                Stayed: {review.date}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="secondary" className="h-7 px-2.5 text-sm">
                {toScore(review.rating)}
              </Badge>
              <StarRating rating={review.rating} />
            </div>
          </div>

          <p className="text-muted-foreground text-sm text-pretty">
            {review.comment}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
