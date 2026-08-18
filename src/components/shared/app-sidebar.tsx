"use client"

/**
 * The sidebar shared by the partner extranet and the admin panel.
 *
 * Extracted from the extranet's original sidebar so both surfaces get the same
 * collapse, active-section and badge behaviour from one implementation. Each
 * surface supplies its own nav tree, brand block and footer.
 */

import * as React from "react"
import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export type AppNavChild = {
  title: string
  href: string
}

export type AppNavEntry = {
  title: string
  href: string
  icon: LucideIcon
  badge?: number
  children?: AppNavChild[]
}

/** True when `href` is `pathname` or one of its ancestor segments. */
export function isNavActive(pathname: string, href: string, root: string) {
  if (href === root) return pathname === root
  return pathname === href || pathname.startsWith(href + "/")
}

export function AppSidebar({
  nav,
  root,
  brand,
  footer,
  onNavigate,
  pathname,
  className,
}: {
  nav: AppNavEntry[]
  /** The surface's index route — matched exactly rather than by prefix. */
  root: string
  brand?: React.ReactNode
  footer?: React.ReactNode
  onNavigate?: () => void
  pathname: string
  className?: string
}) {
  return (
    <div className={cn("flex h-full flex-col", className)}>
      {brand}

      <nav
        aria-label="Sidebar"
        className="flex-1 space-y-1 overflow-y-auto p-3"
      >
        {nav.map((item) =>
          item.children ? (
            <NavGroup
              key={item.href}
              item={item}
              pathname={pathname}
              root={root}
              onNavigate={onNavigate}
            />
          ) : (
            <NavRow
              key={item.href}
              item={item}
              active={isNavActive(pathname, item.href, root)}
              onNavigate={onNavigate}
            />
          )
        )}
      </nav>

      {footer}
    </div>
  )
}

function NavBadge({ value, active }: { value: number; active?: boolean }) {
  return (
    <span
      className={cn(
        "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs tabular-nums",
        active
          ? "bg-primary-foreground text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      {value}
    </span>
  )
}

function NavRow({
  item,
  active,
  onNavigate,
}: {
  item: AppNavEntry
  active: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-visible:ring-ring/50 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-3",
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="flex-1 truncate">{item.title}</span>
      {item.badge ? <NavBadge value={item.badge} active={active} /> : null}
    </Link>
  )
}

function NavGroup({
  item,
  pathname,
  root,
  onNavigate,
}: {
  item: AppNavEntry
  pathname: string
  root: string
  onNavigate?: () => void
}) {
  const sectionActive = isNavActive(pathname, item.href, root)
  const [open, setOpen] = React.useState(false)
  // The active section is always expanded; others follow the manual toggle.
  const expanded = sectionActive || open
  const Icon = item.icon
  const panelId = `nav-${item.href.replace(/\W+/g, "-")}`

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-3 rounded-lg pr-2 pl-3 text-sm transition-colors",
          sectionActive
            ? "text-foreground font-medium"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          className="focus-visible:ring-ring/50 flex flex-1 items-center gap-3 rounded-md py-2 outline-none focus-visible:ring-3"
        >
          <Icon aria-hidden className="size-4 shrink-0" />
          <span className="flex-1 truncate">{item.title}</span>
          {item.badge ? <NavBadge value={item.badge} /> : null}
        </Link>
        <button
          type="button"
          aria-label={`${expanded ? "Collapse" : "Expand"} ${item.title}`}
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="hover:bg-muted focus-visible:ring-ring/50 shrink-0 rounded-md p-1 outline-none focus-visible:ring-3"
        >
          <ChevronRight
            aria-hidden
            className={cn("size-4 transition-transform", expanded && "rotate-90")}
          />
        </button>
      </div>

      {expanded ? (
        <div id={panelId} className="mt-1 ml-5 space-y-1 border-l pl-3">
          {item.children!.map((child) => {
            const active = pathname === child.href
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 block rounded-lg px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-3",
                  active
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {child.title}
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
