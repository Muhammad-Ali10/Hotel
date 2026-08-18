import type { Metadata } from "next"

import { BillingView } from "./_components/billing-view"

export const metadata: Metadata = {
  title: "Subscriptions & Billing · Stayora Admin",
}

export default function AdminBillingPage() {
  return <BillingView />
}
