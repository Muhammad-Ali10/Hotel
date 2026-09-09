import { PageHeader } from "@/components/extranet/shared"
import { FinanceNav } from "./_components/finance-nav"
import { FinanceOverviewView } from "./_components/finance-overview"

export default function FinancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        subtitle="Gross, commission and net — three numbers, never one"
      />

      <FinanceNav />

      <FinanceOverviewView />
    </div>
  )
}
