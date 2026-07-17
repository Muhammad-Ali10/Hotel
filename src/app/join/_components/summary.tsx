import * as React from "react"

import { cn } from "@/lib/utils"

/** Label/value rows used by the registration-summary blocks. */
export function SummaryList({
  rows,
  className,
}: {
  rows: { label: string; value: React.ReactNode }[]
  className?: string
}) {
  return (
    <dl className={cn("divide-y", className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between py-2.5 text-sm">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="font-medium">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
