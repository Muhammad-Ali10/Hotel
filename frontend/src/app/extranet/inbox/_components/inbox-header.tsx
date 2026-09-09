"use client"

import { usePartnerConversations } from "@/lib/api/hooks"
import { PageHeader } from "@/components/extranet/shared"
import { GenerateTicketDialog } from "./generate-ticket-dialog"

/**
 * The count comes from the same query the list below renders.
 *
 * A header counting one source and a table rendering another is how "3 unread"
 * survives above an inbox with nothing in it.
 */
export function InboxHeader() {
  const conversations = usePartnerConversations()

  const items = conversations.data?.items ?? []
  const unread = items.reduce((sum, c) => sum + c.unread, 0)

  return (
    <PageHeader
      title="Guest Messages"
      subtitle={
        conversations.isPending
          ? "Loading…"
          : `${items.length} ${items.length === 1 ? "conversation" : "conversations"} · ${unread} unread`
      }
    >
      <GenerateTicketDialog />
    </PageHeader>
  )
}
