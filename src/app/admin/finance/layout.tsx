import type { Metadata } from "next"

import { FinanceShell } from "./_components/finance-shell"

export const metadata: Metadata = { title: "Finance · Stayora Admin" }

export default function AdminFinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <FinanceShell>{children}</FinanceShell>
}
