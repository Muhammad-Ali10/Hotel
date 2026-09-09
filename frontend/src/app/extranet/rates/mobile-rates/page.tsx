import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { PromotionsBoard } from "@/components/extranet/promotions-board"

export default function MobileRatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Mobile Rates" subtitle="A discount only guests booking from a phone are shown">
        <Button variant="outline" size="sm" render={<Link href="/extranet/rates" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <PromotionsBoard
        lens={{
          channel: "mobile",
          noun: "mobile rate",
          caveat:
            "The device is read from the browser, which a determined guest can fake. That is accepted: the discount is a marketing lever, not a gate on anything that matters (rule #35).",
        }}
      />
    </div>
  )
}
