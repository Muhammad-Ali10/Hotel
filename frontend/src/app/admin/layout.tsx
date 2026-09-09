import type { Metadata } from "next"

import { AdminRoleProvider } from "@/components/admin/role-provider"
import { AdminSidebar } from "@/components/admin/layout/sidebar"
import { AdminTopbar } from "@/components/admin/layout/topbar"
import { AdminRouteGuard } from "@/components/admin/route-guard"
import { RequireRole } from "@/components/auth/require-role"

export const metadata: Metadata = {
  title: "Super Admin",
  description:
    "Platform administration for Stayora — clients, properties, reservations, finance and moderation.",
}

/**
 * Admin shell. Desktop-first per the brief: the sidebar is persistent from
 * `lg` up and collapses into a sheet below that.
 *
 * Two gates, and they are not the same question:
 *
 *   · `RequireRole` — **are you an administrator at all?** Outside the chrome,
 *     so a guest or a partner never paints the navigation and never fires the
 *     badge queries the topbar and sidebar make on mount.
 *   · `AdminRouteGuard` — **which sections may you open?** Inside, because an
 *     administrator refused one section still gets the shell to navigate out of.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireRole role="admin">
      <AdminRoleProvider>
        <div className="flex min-h-dvh flex-col">
          <AdminTopbar />
          <div className="flex flex-1">
            <aside className="bg-card sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto border-r lg:block">
              <AdminSidebar />
            </aside>
            <main className="min-w-0 flex-1">
              <div className="mx-auto max-w-[1660px] px-4 py-6 sm:px-6 lg:px-8">
                <AdminRouteGuard>{children}</AdminRouteGuard>
              </div>
            </main>
          </div>
        </div>
      </AdminRoleProvider>
    </RequireRole>
  )
}
