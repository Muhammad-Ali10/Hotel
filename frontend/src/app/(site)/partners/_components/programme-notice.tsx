import Link from "next/link"
import { Clock3, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/* ============================================================================
 * A programme that does not exist yet, said plainly.
 *
 * Two of the partner pages described commercial arrangements this platform has
 * no machinery for:
 *
 *   · `/partners/affiliate` — four commission tiers (4%, 5.5%, 7%, 8%), a
 *     45-day cookie window, monthly payouts. There is no referral code, no
 *     attribution of any kind, and no way to pay an affiliate anything.
 *   · `/partners/travel-agents` — "Guaranteed 10% commission on every booking",
 *     agent rates, a dedicated desk. `bookings.source` can record
 *     `travel_agency`, and that is the entire extent of it: no agent account,
 *     no agent rate, no commission owed to anybody but the platform.
 *
 * A rate published on a public page is an offer. Publishing one nothing can
 * honour is not a placeholder — it is a term somebody could reasonably expect
 * to be paid under, and the first time anybody tried, there would be no record
 * that they had sent a single booking.
 *
 * So: no numbers, and a way to be told when there are.
 * ========================================================================== */

export function ProgrammeNotice({
  icon: Icon,
  title,
  body,
  subject,
}: {
  icon: LucideIcon
  title: string
  body: string
  /** Pre-fills the subject line, so the enquiry arrives already sorted. */
  subject: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <span className="bg-muted flex size-12 items-center justify-center rounded-full">
          <Icon className="size-6" />
        </span>
        <div className="space-y-2">
          <div className="text-muted-foreground flex items-center justify-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <Clock3 className="size-3.5" />
            Not open yet
          </div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">{title}</h2>
          <p className="text-muted-foreground mx-auto max-w-lg text-sm leading-relaxed">
            {body}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            render={
              <a href={`mailto:partners@stayora.com?subject=${encodeURIComponent(subject)}`}>
                Register your interest
              </a>
            }
          />
          <Button
            variant="outline"
            render={<Link href="/partners/hotels">List a property instead</Link>}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {/* Says what the email does, rather than promising a reply time
              nothing schedules. */}
          We&apos;ll write to you when the terms are settled. No rates are being
          offered until then.
        </p>
      </CardContent>
    </Card>
  )
}
