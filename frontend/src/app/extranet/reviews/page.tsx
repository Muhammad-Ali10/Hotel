import { PageHeader } from "@/components/extranet/shared"
import { ReviewsList } from "./_components/reviews-list"
import { ReviewsStats } from "./_components/reviews-stats"

/*
 * Two buttons used to sit in this header: "Export", which raised
 * `toast.info("Exporting reviews…")`, and "Review Settings", which raised
 * "Opening review settings…". Neither exported anything and neither opened
 * anything — there is no export route on the reviews module and no settings
 * screen to open.
 *
 * They came from `ActionButton`, a component whose entire purpose was to fire a
 * toast on click "so no control is a dead end". It did not stop them being dead
 * ends; it stopped them LOOKING like dead ends, which is worse — a partner
 * waits for a download that was never coming.
 */
export default function ReviewsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Guest Reviews"
        subtitle="Manage and respond to guest reviews across all properties"
      />

      <ReviewsStats />

      <ReviewsList />
    </div>
  )
}
