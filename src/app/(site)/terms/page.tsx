import type { Metadata } from "next"
import { ScrollText } from "lucide-react"

import { LegalShell, type LegalSection } from "../_components/legal-shell"

export const metadata: Metadata = {
  title: "Terms of Service · Stayora",
  description:
    "The terms that govern your use of Stayora and the bookings you make through our platform.",
}

const sections: LegalSection[] = [
  {
    heading: "Agreement to these terms",
    body: [
      "These terms form the agreement between you and Stayora when you browse our platform, create an account, or reserve a stay through us. By using Stayora you accept them in full. If you are booking on behalf of a company or another traveller, you confirm you have the authority to accept these terms for them.",
      "We update these terms from time to time as our service changes. Material changes are announced on this page and, where the change affects an active booking, by email to the address on your account.",
    ],
  },
  {
    heading: "What Stayora is",
    body: [
      "Stayora is a marketplace. We curate and present accommodation offered by independent hotels, resorts and property owners, and we handle the reservation and payment on their behalf. We are not the owner or operator of the properties listed.",
      "The accommodation contract for your stay is between you and the property. Stayora is responsible for the accuracy of the booking we transmit and for the service we provide around it; the property is responsible for the stay itself, including the room, facilities and on-site service.",
    ],
  },
  {
    heading: "Your account",
    body: [
      "You need an account to complete a booking. Keep your credentials confidential and tell us promptly if you believe someone else has accessed your account. You are responsible for activity carried out under your login.",
      "The information you give us — name, contact details, guest names, and any accessibility or special requests — must be accurate. Properties rely on it to prepare for your arrival, and incorrect details can lead to a refused check-in that we cannot refund.",
    ],
  },
  {
    heading: "Bookings, rates and payment",
    body: [
      "Prices are shown per stay in the currency you select, and the total payable — including taxes and property fees we are told about — is displayed before you confirm. Your reservation is confirmed only when you receive a confirmation from us; an availability quote alone does not reserve a room.",
      "Some rates are charged at the time of booking and others are settled at the property. Which applies is stated on the rate you choose. Charges levied on-site by the property, such as resort fees, minibar or parking, are separate and are settled directly with them.",
      "If a rate is published with an obvious error — a decimal in the wrong place, or a price far below the property's normal range — we may cancel the affected booking and refund you in full rather than honour it.",
    ],
  },
  {
    heading: "Changes and cancellations",
    body: [
      "Every rate carries a cancellation policy, shown on the rate and again on your confirmation. Free-cancellation rates can be cancelled without charge up to the stated deadline; non-refundable rates cannot. Changes and cancellations are made from My Bookings in your dashboard.",
      "The full detail of how refunds, deadlines and no-shows are handled is set out in our Cancellation Policy, which forms part of these terms.",
    ],
  },
  {
    heading: "Reviews and content you post",
    body: [
      "Reviews may be submitted only for stays you actually completed through Stayora. Write from your own experience, and do not include personal data about other guests or staff, commercial promotion, or unlawful and abusive content.",
      "You keep ownership of what you post. You grant us a licence to display, reproduce and distribute it in connection with the platform. We may decline or remove content that breaches these terms, and we will tell you when we remove a review you wrote.",
    ],
  },
  {
    heading: "Acceptable use",
    body: [
      "Use Stayora for genuine travel planning and booking. Do not scrape our content, resell our inventory without a written agreement, attempt to interfere with the security or availability of the platform, or make speculative reservations you do not intend to honour.",
      "We may suspend or close an account that breaches these terms, and we will explain why unless doing so would compromise an investigation or someone's safety.",
    ],
  },
  {
    heading: "Our liability",
    body: [
      "We take reasonable care to present accurate property information, but details are supplied by the properties themselves and can change. Where we are at fault, our liability to you is limited to the total amount you paid through Stayora for the booking concerned.",
      "Nothing in these terms limits liability that cannot lawfully be limited, including for death or personal injury caused by negligence, or for fraud. Consumer rights available to you under the law of your country of residence are unaffected.",
    ],
  },
  {
    heading: "Governing law and disputes",
    body: [
      "If something goes wrong, contact our support team first — most issues are resolved quickly and without formality. If we cannot resolve it, these terms are governed by the laws of the jurisdiction in which Stayora is established, without displacing the mandatory consumer protections of your home country.",
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      icon={ScrollText}
      title="Terms of Service"
      summary="The agreement between you and Stayora — what we do, what you can expect from us, and what we ask of you in return."
      updated="12 June 2026"
      sections={sections}
    />
  )
}
