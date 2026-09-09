/**
 * Money, from CENTS — which is the only unit money exists in on this platform.
 *
 * It used to take whole units, and that was a trap nobody could see. Every
 * price the API returns is cents, so a call site that passed one straight in
 * showed a hundred times the real figure: a $320 room read `$32,000` on the
 * checkout summary, and `$725` cards read `$72,500`.
 *
 * Of 164 call sites, 108 had remembered to divide and 56 had not — which is
 * the tell that the default was on the wrong side. It is the caller's job to
 * hand over money, not to convert it first.
 *
 * `maximumFractionDigits: 0` keeps whole-dollar prices clean; a rate is set in
 * whole units everywhere in this product, so there are no cents to lose.
 */
export function formatCurrency(cents: number, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function formatNumber(value: number, locale = "en-US") {
  return new Intl.NumberFormat(locale).format(value)
}

export function formatDate(date: string | Date, locale = "en-US") {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/** "3 hours ago" / "2 days ago" — for notification and activity feeds. */
export function formatRelativeTime(date: string | Date, locale = "en-US") {
  const d = typeof date === "string" ? new Date(date) : date
  const seconds = Math.round((Date.now() - d.getTime()) / 1000)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" })

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ]

  for (const [unit, secondsPerUnit] of units) {
    const value = Math.trunc(seconds / secondsPerUnit)
    if (Math.abs(value) >= 1) return rtf.format(-value, unit)
  }
  return rtf.format(0, "minute")
}
