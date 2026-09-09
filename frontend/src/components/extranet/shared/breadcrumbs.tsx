"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { nav as extranetNav } from "@/components/extranet/layout/sidebar"

type Crumb = { label: string; href?: string }

/** The minimum a nav tree must expose to build a trail. */
type CrumbNavItem = {
  title: string
  href: string
  children?: { title: string; href: string }[]
}

/** True when `href` is `pathname` or one of its ancestor segments. */
function matches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/")
}

/**
 * Builds the "Dashboard / Section / Page" trail for the current route from a
 * sidebar `nav` structure, mirroring the Figma breadcrumb. Shared by the
 * extranet and the admin panel — each passes its own nav and root.
 */
function trailFor(
  pathname: string,
  nav: CrumbNavItem[],
  root: string
): Crumb[] {
  if (pathname === root) return []

  const crumbs: Crumb[] = [{ label: "Dashboard", href: root }]

  // Longest-matching top-level section (skip the Dashboard root).
  const section = nav
    .filter((n) => n.href !== root && matches(pathname, n.href))
    .sort((a, b) => b.href.length - a.href.length)[0]

  if (!section) return crumbs

  const onSection = pathname === section.href
  crumbs.push({
    label: section.title,
    href: onSection ? undefined : section.href,
  })

  if (!onSection) {
    const child = section.children?.find((c) => c.href === pathname)
    crumbs.push({ label: child?.title ?? leafLabel(pathname) })
  }

  return crumbs
}

/** Fallback: title-case the last path segment for routes not in the nav. */
function leafLabel(pathname: string) {
  const seg = pathname.split("/").filter(Boolean).pop() ?? ""
  return seg
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export function Breadcrumbs({
  className,
  nav = extranetNav,
  root = "/extranet",
}: {
  className?: string
  /** Defaults to the extranet nav; the admin passes its own tree. */
  nav?: CrumbNavItem[]
  root?: string
}) {
  const pathname = usePathname()
  const crumbs = trailFor(pathname, nav, root)
  if (crumbs.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm",
        className
      )}
    >
      {crumbs.map((c, i) => (
        <span key={`${c.label}-${i}`} className="flex items-center gap-1.5">
          {i > 0 ? <span className="text-muted-foreground/50">/</span> : null}
          {c.href ? (
            <Link href={c.href} className="hover:text-foreground transition-colors">
              {c.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
