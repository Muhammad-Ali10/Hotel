import type { Metadata } from "next"

import { InboxView } from "./_components/inbox-view"

export const metadata: Metadata = { title: "Inbox" }

export default function AdminInboxPage() {
  return <InboxView />
}
