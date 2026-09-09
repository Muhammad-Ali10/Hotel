import { PageHeader } from "@/components/extranet/shared"
import { BoostNav } from "./_components/boost-nav"
import { Opportunities } from "./_components/opportunities"

export default function BoostPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunity Center"
        subtitle="What is holding this listing back in search, worst first"
      />

      <BoostNav />

      <Opportunities />
    </div>
  )
}
