import type { Metadata } from "next"

import { AuditView } from "./_components/audit-view"

export const metadata: Metadata = {
  title: "Notifications & Audit",
}

export default function AdminAuditPage() {
  return <AuditView />
}
