import type { Metadata } from "next"

import { BillingView } from "./_components/billing-view"

export const metadata: Metadata = {
  title: "Commission & Billing",
}

export default function AdminBillingPage() {
  return <BillingView />
}
