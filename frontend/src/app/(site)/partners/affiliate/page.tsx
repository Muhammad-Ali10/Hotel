import type { Metadata } from "next"
import { Share2 } from "lucide-react"

import { ProgrammeNotice } from "../_components/programme-notice"

/* ============================================================================
 * The affiliate programme, honestly.
 *
 * This page ran to three hundred lines describing one that does not exist: four
 * commission tiers rising from 4% to 8% with monthly volume, a 45-day cookie
 * window, "paid on the net booking value of every completed stay", monthly
 * payouts, an eligibility list and a four-step onboarding.
 *
 * Nothing behind any of it. There is no referral code anywhere in the schema,
 * no attribution on a booking beyond `source`, no affiliate account, and no
 * path by which money could reach one. A publisher who read this page, signed
 * up and sent a thousand bookings would have earned exactly nothing, and there
 * would be no record they had sent anything at all.
 *
 * The page stays so the route does not 404 and the footer link still goes
 * somewhere true. What it says now is that the programme is not open.
 * ========================================================================== */

export const metadata: Metadata = {
  title: "Affiliate Programme",
  description:
    "Stayora's affiliate programme is not open yet. Register your interest and we will write to you when the terms are settled.",
}

export default function AffiliatePage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <ProgrammeNotice
        icon={Share2}
        title="The affiliate programme isn't open yet"
        body="We are not accepting affiliates and there are no commission terms to quote — the tracking that would make either possible does not exist yet. If you write about hotels and want to be told when it does, leave us your details."
        subject="Affiliate programme — register interest"
      />
    </section>
  )
}
