import type { Metadata } from "next"

import { InboxView } from "./_components/inbox-view"

export const metadata: Metadata = { title: "Inbox · Stayora Admin" }

export default function AdminInboxPage() {
  return <InboxView />
}
