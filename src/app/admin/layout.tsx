import type { Metadata } from "next"

import { AdminRoleProvider } from "@/components/admin/role-provider"
import { AdminSidebar } from "@/components/admin/layout/sidebar"
import { AdminTopbar } from "@/components/admin/layout/topbar"
import { AdminRouteGuard } from "@/components/admin/route-guard"

export const metadata: Metadata = {
  title: "Super Admin · Stayora",
  description:
    "Platform administration for Stayora — clients, properties, reservations, finance and moderation.",
}

/**
 * Admin shell. Desktop-first per the brief: the sidebar is persistent from
 * `lg` up and collapses into a sheet below that.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
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
  )
}
