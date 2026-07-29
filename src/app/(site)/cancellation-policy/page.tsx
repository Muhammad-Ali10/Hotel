import type { Metadata } from "next"
import { CalendarX2 } from "lucide-react"

import { LegalShell, type LegalSection } from "../_components/legal-shell"

export const metadata: Metadata = {
  title: "Cancellation Policy · Stayora",
  description:
    "How cancellations, changes and refunds work on Stayora — deadlines, rate types, and what happens if plans change.",
}

const sections: LegalSection[] = [
  {
    heading: "How to cancel or change a booking",
    body: [
      "Open My Bookings in your dashboard, select the reservation, and choose Modify or Cancel. The screen shows the exact refund or price difference before you confirm, so nothing is decided until you accept it.",
      "Cancellations are effective the moment you confirm them, and we email a written confirmation immediately. Cancelling by telephone with the property alone does not cancel a Stayora reservation — always cancel through your dashboard so the record matches.",
    ],
  },
  {
    heading: "Rate types",
    body: [
      "Free cancellation rates can be cancelled at no charge up to the deadline shown on the rate, usually between 24 and 72 hours before check-in. Cancel before the deadline and you are refunded in full.",
      "Partially refundable rates return a stated portion of the total — typically everything except the first night — when you cancel after the free window has closed.",
      "Non-refundable rates are discounted in exchange for certainty for the property. They cannot be refunded once confirmed, including for early departure. The rate type is labelled on the room, on the checkout page, and on your confirmation email.",
    ],
  },
  {
    heading: "Cancellation deadlines",
    body: [
      "Deadlines are expressed in the property's local time zone, not yours. A 48-hour deadline for a 15:00 check-in in Tokyo expires at 15:00 Tokyo time two days before — check the countdown on the booking rather than calculating it yourself.",
      "If a deadline falls on a public holiday it does not move. We send a reminder email 24 hours before a free-cancellation window closes so the date does not pass unnoticed.",
    ],
  },
  {
    heading: "Refunds",
    body: [
      "Refunds are returned to the original payment method. We release them within 48 hours of the cancellation; how quickly the money appears then depends on your bank or card issuer, and typically takes 5 to 10 business days.",
      "Where the property collects payment on arrival, there is nothing for us to refund — but a late cancellation or no-show may still be charged by the property under the rate's terms.",
      "Reward points spent on a cancelled booking are returned to your account at the same time as the refund.",
    ],
  },
  {
    heading: "No-shows and early departure",
    body: [
      "If you do not arrive and have not cancelled, the reservation is treated as a no-show. The property may charge the full stay or the first night, depending on the rate, and the remaining nights are released.",
      "Leaving early does not automatically refund the unused nights. Tell the property at the desk and contact our support team the same day — we will ask on your behalf, though the decision rests with the property.",
    ],
  },
  {
    heading: "Cancellations by the property",
    body: [
      "Occasionally a property has to cancel — overbooking, a maintenance failure, or a closure. When that happens we refund you in full and our team finds you comparable accommodation for the same dates, covering the difference in rate where we reasonably can.",
      "You will hear from us directly rather than from the property, and we will not leave you to rebook alone.",
    ],
  },
  {
    heading: "Exceptional circumstances",
    body: [
      "Where a natural disaster, civil unrest, government travel restriction or similar event makes a stay impossible, we set aside the standard rate rules and work with the property on a full refund or a free date change.",
      "Contact support with your booking reference as soon as you know. For personal emergencies such as illness or bereavement, tell us — many of our partners will waive a fee on request even where the rate does not oblige them to, and we will always ask.",
    ],
  },
  {
    heading: "Group and long-stay bookings",
    body: [
      "Reservations of five rooms or more, and stays beyond 28 nights, are handled under a separate agreement with longer notice periods and, in some cases, a deposit. The applicable terms are set out in writing before the booking is confirmed and take precedence over the standard rules above.",
    ],
  },
]

export default function CancellationPolicyPage() {
  return (
    <LegalShell
      eyebrow="Policies"
      icon={CalendarX2}
      title="Cancellation Policy"
      summary="Plans change. Here is exactly how cancellations, date changes and refunds work across every rate we sell."
      updated="12 June 2026"
      sections={sections}
    />
  )
}
