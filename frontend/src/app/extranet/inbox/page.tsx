import { InboxHeader } from "./_components/inbox-header"
import { InboxView } from "./_components/inbox-view"

export default function InboxPage() {
  return (
    <div className="space-y-6">
      <InboxHeader />

      <InboxView />
    </div>
  )
}
