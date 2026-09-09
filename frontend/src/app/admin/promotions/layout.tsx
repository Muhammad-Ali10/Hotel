import type { Metadata } from "next"

import { PromotionsShell } from "./_components/promotions-shell"

export const metadata: Metadata = { title: "Promotions" }

export default function AdminPromotionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <PromotionsShell>{children}</PromotionsShell>
}
