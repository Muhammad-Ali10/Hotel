import type { Metadata } from "next"
import { Suspense } from "react"

import { ReviewsView } from "./_components/reviews-view"

export const metadata: Metadata = {
  title: "My Reviews — Stayora",
  description: "Reviews you've written and stays waiting to be reviewed.",
}

export default function ReviewsPage() {
  return (
    <Suspense>
      <ReviewsView />
    </Suspense>
  )
}
