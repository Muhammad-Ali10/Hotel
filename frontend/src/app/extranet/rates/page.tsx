import { PageHeader } from "@/components/extranet/shared"
import { RatePlansGrid } from "./_components/rate-plans-grid"

export default function RatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate Plans"
        subtitle="What this property sells, and on what terms"
      />

      <RatePlansGrid />
    </div>
  )
}
