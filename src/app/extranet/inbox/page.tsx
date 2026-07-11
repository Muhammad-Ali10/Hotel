import { conversations } from "@/data/extranet"
import { PageHeader } from "@/components/extranet/shared"
import { GenerateTicketDialog } from "./_components/generate-ticket-dialog"
import { InboxView } from "./_components/inbox-view"

const unread = conversations.filter((c) => c.unread).length

export default function InboxPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox"
        subtitle={`${conversations.length} conversations · ${unread} unread`}
      >
        <GenerateTicketDialog />
      </PageHeader>

      <InboxView />
    </div>
  )
}
