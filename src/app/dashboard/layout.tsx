import { DashboardHeader } from "@/components/layout/dashboard-header"
import { DashboardFooter } from "@/components/layout/dashboard-footer"
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <DashboardHeader />
      <div className="mx-auto flex w-full max-w-[1700px] flex-1 gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="bg-card sticky top-20 hidden h-[calc(100dvh-6rem)] w-64 shrink-0 overflow-y-auto rounded-xl border lg:block">
          <DashboardSidebar />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <DashboardFooter />
    </div>
  )
}
