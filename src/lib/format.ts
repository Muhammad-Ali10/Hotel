export function formatCurrency(amount: number, currency = "USD", locale = "en-US") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
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
