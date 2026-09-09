import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { PromotionsBoard } from "@/components/extranet/promotions-board"

export default function ChoosePromotionPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="New Promotion" subtitle="Every discount you run, and the one you are about to add">
        <Button variant="outline" size="sm" render={<Link href="/extranet/promotions" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <PromotionsBoard
        lens={{ noun: "promotion" }}
      />
    </div>
  )
}
