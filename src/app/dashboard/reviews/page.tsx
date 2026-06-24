import { userReviews } from "@/data"

import { ReviewCard } from "./_components/review-card"

export default function ReviewsPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        My Reviews
      </h1>

      <div className="space-y-4">
        {userReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  )
}
