import type { Metadata } from "next"

import { AnalyticsShell } from "./_components/analytics-shell"

export const metadata: Metadata = { title: "Analytics" }

export default function AdminAnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AnalyticsShell>{children}</AnalyticsShell>
}
