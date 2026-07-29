import type { Metadata } from "next"
import { ShieldCheck } from "lucide-react"

import { LegalShell, type LegalSection } from "../_components/legal-shell"

export const metadata: Metadata = {
  title: "Privacy Policy · Stayora",
  description:
    "How Stayora collects, uses and protects your personal information — and the choices you have over it.",
}

const sections: LegalSection[] = [
  {
    heading: "The short version",
    body: [
      "We collect what we need to find you somewhere to stay, complete your booking, and support you before and after the trip. We do not sell your personal information, and we do not share it with properties beyond what they need to host you.",
      "The sections below set out the detail: what we hold, why we hold it, who sees it, how long we keep it, and how to get it changed or deleted.",
    ],
  },
  {
    heading: "Information you give us",
    body: [
      "When you create an account we collect your name, email address and password. When you book we also collect the guest names on the reservation, your contact number, billing address, and payment details, along with any special requests you add — early check-in, dietary notes, or accessibility requirements.",
      "If you contact support, submit a ticket, or message a property through Stayora, we keep that correspondence so the next person who helps you has the context.",
    ],
  },
  {
    heading: "Information we collect automatically",
    body: [
      "Like most sites, we record technical information when you visit: IP address, device and browser type, pages viewed, and the searches and filters you use. This tells us which properties to surface and where the booking flow is losing people.",
      "Cookies and similar technologies do part of this work. Which ones we set, and how to refuse the non-essential ones, is covered in our Cookie Policy.",
    ],
  },
  {
    heading: "Why we use it",
    body: [
      "To take and fulfil your booking, and to pass the property the details it needs to host you. To take payment and issue refunds. To send booking confirmations, reminders and service messages, which are not marketing and cannot be switched off while a booking is live.",
      "To personalise search results and recommendations, to run our rewards programme, to detect fraudulent bookings and payments, and to meet our legal and tax obligations.",
      "To send marketing about offers and destinations, but only where you have opted in. Every marketing email carries a one-click unsubscribe, and unsubscribing never affects an existing reservation.",
    ],
  },
  {
    heading: "Who we share it with",
    body: [
      "The property you book with, so it can prepare for your arrival. It receives your guest names, dates, room and rate, and any request you attached — not your payment card details.",
      "Payment processors, who handle card data under their own security standards; fraud-prevention and identity services; and the infrastructure, analytics and email providers who run parts of our platform under contract. Each is bound to use your data only on our instructions.",
      "Authorities, where the law requires it or where disclosure is necessary to protect someone's safety or our legal rights. We do not sell personal information to advertisers or data brokers.",
    ],
  },
  {
    heading: "Where your data is held",
    body: [
      "Stayora operates internationally, so your information may be processed in a country other than your own — including by a property you book abroad, which necessarily receives your details to host you.",
      "Where data leaves your region, we rely on recognised transfer mechanisms such as standard contractual clauses and apply the same protections described in this policy regardless of where processing takes place.",
    ],
  },
  {
    heading: "How long we keep it",
    body: [
      "Booking and payment records are retained for as long as tax and accounting law requires, typically several years after the stay. Account details are kept while your account is open, and support correspondence for as long as it may be needed to resolve a related issue.",
      "When a retention period ends we delete the data or irreversibly anonymise it so it can no longer be linked back to you.",
    ],
  },
  {
    heading: "Your rights and choices",
    body: [
      "You can access, correct, export or delete your personal data, object to certain processing, and withdraw a consent you previously gave. Most of this is self-service from Profile and Settings in your dashboard; anything else, ask us and we will action it.",
      "We respond to requests within one month. Deleting your account does not remove records we are legally required to retain, such as invoices for completed stays — we will tell you what has to stay and why.",
      "If you believe we have handled your data badly, tell us first so we can put it right. You also have the right to complain to the data-protection authority in your country.",
    ],
  },
  {
    heading: "Security",
    body: [
      "Personal data is encrypted in transit and at rest. Access inside Stayora is limited to staff who need it for their role and is logged. Payment card numbers are handled by our payment providers and are never stored on our own systems in readable form.",
      "No system is perfectly secure. If a breach affects your personal data and creates a real risk to you, we will notify you and the relevant authority without undue delay.",
    ],
  },
  {
    heading: "Children",
    body: [
      "Stayora is intended for adults. We do not knowingly create accounts for children under 16. Children can of course be named as guests on a booking made by an adult. If you believe a child has registered an account, contact us and we will remove it.",
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      icon={ShieldCheck}
      title="Privacy Policy"
      summary="What we collect, why we collect it, who sees it, and the control you keep over your own information."
      updated="12 June 2026"
      sections={sections}
    />
  )
}
