import type { Metadata } from "next"

import { ActivePropertyProvider } from "@/components/extranet/active-property"
import { ExtranetTopbar } from "@/components/extranet/layout/topbar"
import { ExtranetSidebar } from "@/components/extranet/layout/sidebar"
import { RequireRole } from "@/components/auth/require-role"

export const metadata: Metadata = {
  title: "Partner Extranet",
  description:
    "Manage your properties, reservations, rates and performance on Stayora.",
}

/**
 * The partner surface.
 *
 * `RequireRole` is the outermost thing here, above `ActivePropertyProvider` and
 * the chrome, deliberately: typing `/extranet` into the address bar signed out
 * used to render the entire shell — sidebar, fifty-six screens, a property
 * selector asking the API for properties nobody was signed in to own. The API
 * refused all of it, so nothing leaked; the product simply told a stranger they
 * were inside a business they had no part of.
 *
 * Guarding the layout rather than each page means a screen added tomorrow is
 * protected the day it is written.
 */
export default function ExtranetLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RequireRole role="partner">
      {/*
       * The chosen property is shared by the whole surface.
       *
       * Almost every screen below answers a question about ONE property, so the
       * choice belongs above them — and above the topbar, which is where it is
       * made.
       */}
      <ActivePropertyProvider>
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
      </ActivePropertyProvider>
    </RequireRole>
  )
}
