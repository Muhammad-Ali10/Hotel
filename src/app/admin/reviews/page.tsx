import type { Metadata } from "next"

import { ReviewsView } from "./_components/reviews-view"

export const metadata: Metadata = { title: "Guest Reviews · Stayora Admin" }

export default function AdminReviewsPage() {
  return <ReviewsView />
}
