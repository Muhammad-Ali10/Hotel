"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, ShieldCheck } from "lucide-react"

import { useAdminCounts } from "@/lib/admin/api/hooks"
import { adminNav, ADMIN_ROOT } from "@/lib/admin/nav"
import { canView } from "@/lib/admin/rbac"
import { AppSidebar, type AppNavEntry } from "@/components/shared/app-sidebar"
import { useAdminRole } from "@/components/admin/role-provider"
import { ROLE_LABELS } from "@/lib/admin/rbac"

/**
 * Admin sidebar. Uses the shared `AppSidebar` for behaviour, and filters the
 * tree by the current role so a Finance account never sees an Inbox link it
 * cannot open.
 */
export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { role } = useAdminRole()
  /* Nothing is counted for somebody the guard is about to refuse. */
  const { badges } = useAdminCounts(Boolean(role))

  /*
   * A badge appears only once its count has arrived.
   *
   * `useAdminCounts` reports `0` while its queries are in flight, and zero
   * renders as no badge — so the sidebar never shows a number it is about to
   * correct.
   */

  const nav: AppNavEntry[] = adminNav
    .filter((item) => canView(role, item.resource))
    .map((item) => ({
      title: item.title,
      href: item.href,
      icon: item.icon,
      badge: item.badge ? badges[item.badge] : undefined,
      children: item.children,
    }))

  return (
    <AppSidebar
      nav={nav}
      root={ADMIN_ROOT}
      pathname={pathname}
      onNavigate={onNavigate}
      brand={
        <Link
          href={ADMIN_ROOT}
          onClick={onNavigate}
          className="flex items-center gap-3 border-b p-4"
        >
          <span className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="font-heading truncate text-sm font-semibold">
              Stayora Admin
            </p>
            <p className="text-muted-foreground text-xs">
              {role ? ROLE_LABELS[role] : "—"}
            </p>
          </div>
        </Link>
      }
      footer={
        <div className="border-t p-3">
          <Link
            href="/"
            onClick={onNavigate}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <ChevronLeft className="size-4" />
            Back to Stayora
          </Link>
        </div>
      }
    />
  )
}
