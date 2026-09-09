import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { PromotionsBoard } from "@/components/extranet/promotions-board"

export default function GeniusPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Genius Discounts" subtitle="A discount only guests carrying the Genius tier are shown">
        <Button variant="outline" size="sm" render={<Link href="/extranet/boost" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <PromotionsBoard
        lens={{
          channel: "genius",
          kind: "genius",
          noun: "Genius deal",
          caveat:
            "Unlike the mobile channel, this one is read from the signed-in account, so it cannot be faked from a browser.",
        }}
      />
    </div>
  )
}
