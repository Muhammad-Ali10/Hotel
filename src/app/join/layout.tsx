import type { Metadata } from "next"

import { WizardProvider } from "./_components/wizard-provider"
import { WizardHeader } from "./_components/wizard-header"

export const metadata: Metadata = {
  title: "List your property · Stayora",
  description:
    "Create a Stayora partner account and list your property in a few guided steps.",
}

export default function JoinLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <WizardProvider>
      <div className="bg-muted/30 flex min-h-dvh flex-col">
        <WizardHeader />
        <main className="flex-1">{children}</main>
      </div>
    </WizardProvider>
  )
}
