// The ordered wizard flow. Each step maps a route to its Figma step number and
// tells the header which chrome to render. Steps 24–27 are intentionally absent
// (not designed) — the Figma jumps 23 → 28, so the visible counter does too.

export type ChromeMode = "account" | "wizard" | "plain"

export type WizardStep = {
  slug: string
  /** Route under /join. The entry step is "" (i.e. /join itself). */
  path: string
  /** Figma "Step N of 31" number, or null for account/terminal screens. */
  step: number | null
  chrome: ChromeMode
}

export const TOTAL_STEPS = 31

export const steps: WizardStep[] = [
  // Account
  { slug: "create-account", path: "", step: null, chrome: "account" },
  { slug: "contact", path: "contact", step: null, chrome: "account" },
  { slug: "password", path: "password", step: null, chrome: "account" },
  { slug: "verify", path: "verify", step: null, chrome: "account" },

  // Property
  { slug: "property-type", path: "property-type", step: 5, chrome: "wizard" },
  { slug: "location", path: "location", step: 6, chrome: "wizard" },
  { slug: "rooms", path: "rooms", step: 7, chrome: "wizard" },
  { slug: "amenities", path: "amenities", step: 8, chrome: "wizard" },
  { slug: "photos", path: "photos", step: 9, chrome: "wizard" },
  { slug: "pricing", path: "pricing", step: 10, chrome: "wizard" },
  { slug: "policies", path: "policies", step: 11, chrome: "wizard" },
  { slug: "payout", path: "payout", step: 12, chrome: "wizard" },
  { slug: "submitted", path: "submitted", step: 12, chrome: "plain" },
  { slug: "setup", path: "setup", step: 13, chrome: "wizard" },

  // Unit
  { slug: "unit-details", path: "unit/details", step: 14, chrome: "wizard" },
  { slug: "unit-amenities", path: "unit/amenities", step: 15, chrome: "wizard" },
  { slug: "unit-bathroom", path: "unit/bathroom", step: 16, chrome: "wizard" },
  { slug: "unit-name", path: "unit/name", step: 17, chrome: "wizard" },
  { slug: "unit-price", path: "unit/price", step: 18, chrome: "wizard" },
  { slug: "unit-rate-plan", path: "unit/rate-plan", step: 19, chrome: "wizard" },
  { slug: "overview", path: "overview", step: 20, chrome: "wizard" },

  // Final
  { slug: "payments", path: "payments", step: 21, chrome: "wizard" },
  { slug: "invoicing", path: "invoicing", step: 22, chrome: "wizard" },
  { slug: "cancellation", path: "cancellation", step: 23, chrome: "wizard" },
  { slug: "how-bookings-work", path: "how-bookings-work", step: 28, chrome: "wizard" },
  { slug: "verification", path: "verification", step: 29, chrome: "wizard" },
  { slug: "setup-overview", path: "setup-overview", step: 30, chrome: "wizard" },
  { slug: "complete", path: "complete", step: 31, chrome: "wizard" },
  { slug: "done", path: "done", step: null, chrome: "plain" },
]

export function href(path: string) {
  return path ? `/join/${path}` : "/join"
}

/** Resolve the current step from a pathname like "/join/unit/details". */
export function stepFromPathname(pathname: string): WizardStep | undefined {
  const rest = pathname.replace(/^\/join\/?/, "").replace(/\/$/, "")
  return steps.find((s) => s.path === rest)
}

export function stepIndex(slug: string) {
  return steps.findIndex((s) => s.slug === slug)
}

export function nextStep(slug: string): WizardStep | undefined {
  return steps[stepIndex(slug) + 1]
}

export function prevStep(slug: string): WizardStep | undefined {
  const i = stepIndex(slug)
  return i > 0 ? steps[i - 1] : undefined
}
