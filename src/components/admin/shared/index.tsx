"use client"

/**
 * Small admin-specific shared pieces. Anything generic enough for both
 * surfaces lives in `components/shared/*` or `components/extranet/shared/*`
 * and is re-exported here so screens have one import.
 */

import * as React from "react"
import Link from "next/link"
import { Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"
import { adminNav, ADMIN_ROOT } from "@/lib/admin/nav"
import { PageHeader } from "@/components/extranet/shared"

export {
  StatCard,
  StatGrid,
  StatusPill,
  DeltaBadge,
  SectionCard,
  ActionButton,
  ConfirmDialog,
  Icon,
} from "@/components/extranet/shared"

/** `PageHeader` pre-wired to the admin nav so breadcrumbs resolve correctly. */
export function AdminPageHeader(
  props: Omit<
    React.ComponentProps<typeof PageHeader>,
    "breadcrumbNav" | "breadcrumbRoot"
  >
) {
  return (
    <PageHeader {...props} breadcrumbNav={adminNav} breadcrumbRoot={ADMIN_ROOT} />
  )
}

/**
 * Platform currency formatter. Everything is USD after the Phase 1 decision to
 * unify the dataset; routing all money through here means a future
 * multi-currency change is a one-file edit.
 */
export function Money({
  value,
  compact = false,
  className,
}: {
  value: number
  /** Renders $1.2M / $847K for headline figures. */
  compact?: boolean
  className?: string
}) {
  const text = compact ? compactCurrency(value) : formatCurrency(value)
  return (
    <span className={cn("tabular-nums", className)}>
      {text}
    </span>
  )
}

export function compactCurrency(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${Math.round(value / 1_000)}K`
  return formatCurrency(value)
}

/** Label/value grid used by every detail modal and the property detail page. */
export function DescriptionList({
  items,
  columns = 2,
  className,
}: {
  items: { label: string; value: React.ReactNode }[]
  columns?: 1 | 2 | 3
  className?: string
}) {
  return (
    <dl
      className={cn(
        "grid gap-x-6 gap-y-3.5",
        columns === 1 && "grid-cols-1",
        columns === 2 && "grid-cols-1 sm:grid-cols-2",
        columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0 space-y-0.5">
          <dt className="text-muted-foreground text-xs">{item.label}</dt>
          <dd className="truncate text-sm font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Star rating with a numeric label. The Figma rendered ★★★★★ for every row
 * regardless of the real value, so the number is always shown alongside.
 */
export function StarRating({
  value,
  max = 5,
  showValue = true,
  className,
}: {
  value: number
  max?: number
  showValue?: boolean
  className?: string
}) {
  const rounded = Math.round(value)
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span aria-hidden className="inline-flex">
        {Array.from({ length: max }, (_, i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              i < rounded
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            )}
          />
        ))}
      </span>
      {showValue ? (
        <span className="text-muted-foreground text-xs tabular-nums">
          {value.toFixed(1)}
        </span>
      ) : null}
      <span className="sr-only">
        {value.toFixed(1)} out of {max}
      </span>
    </span>
  )
}

/** Two-line table cell: a primary label above muted secondary text. */
export function CellStack({
  primary,
  secondary,
  href,
}: {
  primary: React.ReactNode
  secondary?: React.ReactNode
  href?: string
}) {
  const label = href ? (
    <Link
      href={href}
      className="hover:text-primary font-medium underline-offset-2 hover:underline"
    >
      {primary}
    </Link>
  ) : (
    <span className="font-medium">{primary}</span>
  )

  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{label}</span>
      {secondary ? (
        <span className="text-muted-foreground truncate text-xs">
          {secondary}
        </span>
      ) : null}
    </span>
  )
}

/** The muted explanatory footnote several Figma screens end with. */
export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground bg-muted/40 rounded-lg border px-4 py-3 text-sm text-pretty">
      {children}
    </p>
  )
}
