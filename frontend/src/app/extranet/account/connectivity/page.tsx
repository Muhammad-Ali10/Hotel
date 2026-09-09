import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader, SectionCard } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Channel manager connectivity — not built, and said so.
 *
 * The old screen showed a provider name, a "Connected" badge, a last-sync
 * timestamp and a Sync Now button that fired a toast. None of it existed:
 * there is no channel-manager integration in this product, no credentials
 * stored, and nothing that has ever synced.
 *
 * That is a worse lie than most. A partner who believes their inventory is
 * syncing to another site will sell the same room twice, and the overbooking
 * guard here cannot see a booking that was taken somewhere else.
 *
 * So the screen states the position plainly and points at the two things that
 * ARE real: the calendar, which is where inventory is actually set, and
 * support, which is where to ask about a provider.
 */
export default function ConnectivityPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Connectivity"
        subtitle="Channel managers and external distribution"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/account" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-heading text-base font-semibold">
            Not connected to anything
          </h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Stayora does not currently exchange inventory or rates with channel
            managers. Nothing about your calendar reaches another site, and no booking
            taken elsewhere reaches this one.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            This matters for how you sell: because the two systems cannot see each
            other, a room left open in both can be sold twice. The overbooking check
            here only knows about bookings made here. If you list the same rooms
            elsewhere, keep the allocations separate rather than the totals shared.
          </p>
        </CardContent>
      </Card>

      <SectionCard
        title="Where inventory is actually set"
        description="Until a connection exists, this is the only source."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/extranet/rates/calendar">Calendar</Link>}
          />
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/extranet/rates/open-close">Open / close dates</Link>}
          />
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/extranet/inbox/support">Ask about a provider</Link>}
          />
        </div>
      </SectionCard>
    </div>
  )
}
