import { PageHeader } from "@/components/extranet/shared"
import { PromotionsNav } from "./_components/promotions-nav"
import { CreatePromotionDialog } from "./_components/create-promotion-dialog"
import {
  PromotionsHint,
  PromotionsStats,
  PromotionsTable,
} from "./_components/promotions-table"

export default function PromotionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Promotions"
        subtitle="Discounts you run across your portfolio"
      >
        <CreatePromotionDialog />
      </PageHeader>

      <PromotionsNav />
      <PromotionsHint />
      <PromotionsStats />
      <PromotionsTable />
    </div>
  )
}
