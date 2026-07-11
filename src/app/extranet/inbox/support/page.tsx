import { supportStats } from "@/data/extranet"
import { PageHeader } from "@/components/extranet/shared"
import { GenerateTicketDialog } from "../_components/generate-ticket-dialog"
import { SupportView } from "./_components/support-view"

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        subtitle={`${supportStats.total} tickets · ${supportStats.open} open · ${supportStats.resolved} resolved`}
      >
        <GenerateTicketDialog />
      </PageHeader>

      <SupportView />
    </div>
  )
}
