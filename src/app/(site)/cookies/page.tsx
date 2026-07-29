import type { Metadata } from "next"
import { Cookie } from "lucide-react"

import { LegalShell, type LegalSection } from "../_components/legal-shell"

export const metadata: Metadata = {
  title: "Cookie Policy · Stayora",
  description:
    "The cookies Stayora uses, what each category does, and how to change your preferences at any time.",
}

const sections: LegalSection[] = [
  {
    heading: "What cookies are",
    body: [
      "A cookie is a small text file a site stores on your device so it can recognise that device on the next request. We also use closely related technologies — local storage and pixels — and treat them all the same way in this policy.",
      "Some cookies last only until you close the tab. Others persist so that your currency, language and theme are still right when you come back next week.",
    ],
  },
  {
    heading: "Strictly necessary",
    body: [
      "These keep you signed in, hold the contents of your booking while you move through checkout, balance traffic across our servers, and protect the payment step against fraud and cross-site request forgery.",
      "The site cannot function without them, so they are set whatever your preferences. They carry no advertising purpose and are not shared with third parties for their own use.",
    ],
  },
  {
    heading: "Preference cookies",
    body: [
      "These remember the choices you make: light or dark theme, display currency, language, and recently viewed properties so you can pick up a search where you left it.",
      "Refusing them does not break the site, but it will ask you to make those choices again on every visit.",
    ],
  },
  {
    heading: "Analytics cookies",
    body: [
      "These tell us, in aggregate, which pages are visited, which searches return nothing useful, and where people abandon the booking flow. That is how we decide what to fix next.",
      "The data is aggregated and we do not use it to build a profile of you as an individual. You can refuse analytics cookies without losing any functionality.",
    ],
  },
  {
    heading: "Marketing cookies",
    body: [
      "These measure whether a campaign actually led to a booking and allow us to show relevant offers on other platforms. They are set only where you have opted in, and never before you have.",
      "Refuse them and you will still see advertising elsewhere on the web — it simply will not be informed by your activity on Stayora.",
    ],
  },
  {
    heading: "Managing your preferences",
    body: [
      "You can change your cookie choices at any time from Settings in your dashboard. Your decision is recorded per device, so you will be asked again on a new browser or after clearing your cookies.",
      "Every major browser also lets you block or delete cookies directly, usually under Privacy or Security settings. Blocking strictly necessary cookies at the browser level will stop you from signing in or completing a booking.",
    ],
  },
  {
    heading: "Third parties",
    body: [
      "A small number of cookies are set by providers who run parts of our service — payment processing, error monitoring and analytics. They act on our instructions and are contractually barred from using the data for their own purposes.",
      "We review this list as our providers change. Material additions are reflected on this page along with the updated date at the top.",
    ],
  },
]

export default function CookiesPage() {
  return (
    <LegalShell
      eyebrow="Legal"
      icon={Cookie}
      title="Cookie Policy"
      summary="The cookies we set, what each one is for, and how to change your mind about them at any time."
      updated="12 June 2026"
      sections={sections}
    />
  )
}
