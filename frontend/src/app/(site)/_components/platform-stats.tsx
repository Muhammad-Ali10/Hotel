"use client"

import { usePlatformStats } from "@/lib/api/hooks"
import { formatNumber } from "@/lib/format"

/* ============================================================================
 * The platform's figures, counted rather than claimed (rule #113).
 *
 * `/about` and `/press` both carried the same four numbers, written into the
 * files: "2,400+ curated properties", "68 countries", "1.2M stays booked",
 * "4.8/5 average guest rating". The catalogue holds eight properties in two
 * countries and has no published reviews — a visitor could disprove all four by
 * clicking "Hotels" in the header.
 *
 * What is countable is now counted. What is not — how many people work here,
 * when the company was founded, where it is registered — is simply not stated,
 * because there is nothing in this system that knows.
 *
 * A figure that has not loaded renders as a dash, never as zero. "0 countries"
 * is a worse lie than no number at all.
 * ========================================================================== */

export function PlatformStats({ className }: { className?: string }) {
  const stats = usePlatformStats()
  const data = stats.data

  const rows: { value: string; label: string }[] = [
    {
      value: data ? formatNumber(data.properties) : "—",
      label: data?.properties === 1 ? "Property" : "Properties",
    },
    {
      value: data ? formatNumber(data.cities) : "—",
      label: data?.cities === 1 ? "City" : "Cities",
    },
    {
      value: data ? formatNumber(data.countries) : "—",
      label: data?.countries === 1 ? "Country" : "Countries",
    },
    /*
     * Only once there is something to average. A rating card reading "—" is
     * honest about a catalogue nobody has reviewed yet; "0/5" would say every
     * property on it is terrible.
     */
    data?.averageRating != null
      ? {
          value: `${data.averageRating.toFixed(1)}/5`,
          label: `From ${formatNumber(data.reviews)} guest ${data.reviews === 1 ? "review" : "reviews"}`,
        }
      : { value: "—", label: "No guest reviews yet" },
  ]

  return (
    <dl className={className}>
      {rows.map((row) => (
        <div key={row.label} className="text-center">
          <dt className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {row.value}
          </dt>
          <dd className="text-muted-foreground mt-1 text-sm">{row.label}</dd>
        </div>
      ))}
    </dl>
  )
}
