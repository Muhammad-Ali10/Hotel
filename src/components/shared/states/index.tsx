"use client"

/**
 * The four screen states the Figma never drew — empty, error, permission
 * denied, and a generic "nothing selected" placeholder. Shared across the
 * admin panel and available to the extranet.
 */

import * as React from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Inbox,
  Lock,
  RefreshCw,
  SearchX,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ROLE_LABELS, type AdminRole } from "@/lib/admin/rbac"

type StateShellProps = {
  icon: LucideIcon
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
  className?: string
  /** `page` centres in the viewport; `inline` sits inside a card or table. */
  variant?: "page" | "inline"
  tone?: "neutral" | "danger"
}

function StateShell({
  icon: Icon,
  title,
  description,
  children,
  className,
  variant = "inline",
  tone = "neutral",
}: StateShellProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 text-center",
        variant === "page" ? "min-h-[60vh] py-16" : "py-14",
        className
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-11 items-center justify-center rounded-full",
          tone === "danger"
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold">{title}</p>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-md text-sm text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          {children}
        </div>
      ) : null}
    </div>
  )
}

/** Nothing to show yet, or a filter matched nothing. */
export function EmptyState({
  title = "Nothing here yet",
  description,
  /** Set when the emptiness is the result of a search or filter. */
  filtered = false,
  onClearFilters,
  action,
  variant,
  className,
}: {
  title?: string
  description?: React.ReactNode
  filtered?: boolean
  onClearFilters?: () => void
  action?: React.ReactNode
  variant?: "page" | "inline"
  className?: string
}) {
  return (
    <StateShell
      icon={filtered ? SearchX : Inbox}
      title={filtered ? "No matches" : title}
      description={
        description ??
        (filtered
          ? "No records match the current search and filters."
          : undefined)
      }
      variant={variant}
      className={className}
    >
      {filtered && onClearFilters ? (
        <Button variant="outline" size="sm" onClick={onClearFilters}>
          Clear filters
        </Button>
      ) : null}
      {action}
    </StateShell>
  )
}

/** A request failed. Always offers a retry — never a dead end. */
export function ErrorState({
  title = "Something went wrong",
  description,
  error,
  onRetry,
  variant,
  className,
}: {
  title?: string
  description?: React.ReactNode
  error?: { message?: string } | null
  onRetry?: () => void
  variant?: "page" | "inline"
  className?: string
}) {
  return (
    <StateShell
      icon={AlertTriangle}
      tone="danger"
      title={title}
      description={
        description ??
        error?.message ??
        "The request could not be completed. Please try again."
      }
      variant={variant}
      className={className}
    >
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="size-4" />
          Try again
        </Button>
      ) : null}
    </StateShell>
  )
}

/** The signed-in role may not open this section. */
export function PermissionDenied({
  role,
  section,
  className,
}: {
  role: AdminRole
  section: string
  className?: string
}) {
  return (
    <Card className={className}>
      <CardContent className="p-0">
        <StateShell
          icon={Lock}
          title="You don't have access to this section"
          variant="page"
          description={
            <>
              <span className="font-medium">{ROLE_LABELS[role]}</span> accounts
              cannot view {section}. Ask a Super Admin to change your role, or
              head back to the dashboard.
            </>
          }
        >
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/admin">Back to dashboard</Link>}
          />
        </StateShell>
      </CardContent>
    </Card>
  )
}

/** Master–detail placeholder, e.g. the inbox with no conversation open. */
export function NothingSelected({
  icon = Inbox,
  title,
  description,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  className?: string
}) {
  return (
    <StateShell
      icon={icon}
      title={title}
      description={description}
      className={className}
    />
  )
}
