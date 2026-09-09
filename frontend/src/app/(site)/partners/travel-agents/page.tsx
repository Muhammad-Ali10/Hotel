import type { Metadata } from "next"
import { Briefcase } from "lucide-react"

import { ProgrammeNotice } from "../_components/programme-notice"

/* ============================================================================
 * The travel agent programme, honestly.
 *
 * "Guaranteed 10% commission on every booking", agent rates across 2,400
 * curated properties, a dedicated agent desk, and a four-step application — a
 * complete commercial offer for something that does not exist.
 *
 * What exists is one enum value: `bookings.source` can be `travel_agency`. No
 * agent account, no agent rate plan, no commission owed to anybody except the
 * platform, and no way to pay one. "Guaranteed" is the word that makes it
 * serious: an agent booking against that promise has a claim, and there is no
 * record their bookings were theirs.
 *
 * "2,400 curated properties" was the same invented figure that was on `/about`
 * and `/press`. The catalogue holds eight.
 * ========================================================================== */

export const metadata: Metadata = {
  title: "Travel Agents",
  description:
    "Stayora's travel agent programme is not open yet. Register your interest and we will write to you when the terms are settled.",
}

export default function TravelAgentsPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
      <ProgrammeNotice
        icon={Briefcase}
        title="The travel agent programme isn't open yet"
        body="We cannot offer agent rates or commission yet — there is no agent account to book against and no way to attribute a booking to you, so any rate quoted here would be one we could not honour. Tell us about your agency and we will be in touch when that changes."
        subject="Travel agent programme — register interest"
      />
    </section>
  )
}
