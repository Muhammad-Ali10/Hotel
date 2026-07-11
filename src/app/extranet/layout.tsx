import type { Metadata } from "next"

import { ExtranetTopbar } from "@/components/extranet/layout/topbar"
import { ExtranetSidebar } from "@/components/extranet/layout/sidebar"

export const metadata: Metadata = {
  title: "Partner Extranet · Stayora",
  description:
    "Manage your properties, reservations, rates and performance on Stayora.",
}

export default function ExtranetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <ExtranetTopbar />
      <div className="flex flex-1">
        <aside className="bg-card sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 overflow-y-auto border-r lg:block">
          <ExtranetSidebar />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
