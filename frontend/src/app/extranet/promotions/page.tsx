import { PageHeader } from "@/components/extranet/shared"
import { PromotionsBoard } from "@/components/extranet/promotions-board"
import { PromotionsNav } from "./_components/promotions-nav"

export default function PromotionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Your Promotions"
        subtitle="Every discount you run, across the portfolio"
      />

      <PromotionsNav />

      <PromotionsBoard lens={{ noun: "promotion" }} />
    </div>
  )
}
