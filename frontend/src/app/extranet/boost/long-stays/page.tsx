import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { PromotionsBoard } from "@/components/extranet/promotions-board"

export default function LongStaysPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Long Stays" subtitle="A discount that only applies from a given number of nights">
        <Button variant="outline" size="sm" render={<Link href="/extranet/boost" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <PromotionsBoard
        lens={{
          kind: "long_stay",
          minStayAtLeast: 2,
          noun: "long-stay deal",
          caveat:
            "The minimum stay is what does the work — the label only decides which screen groups it (rule #16).",
        }}
      />
    </div>
  )
}
