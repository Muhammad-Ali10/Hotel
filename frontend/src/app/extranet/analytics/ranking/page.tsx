import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { RankingView } from "./_components/ranking-view"

export default function RankingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Search Ranking" subtitle="SUBSearch Ranking">
        <Button variant="outline" size="sm" render={<Link href="/extranet/analytics" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <RankingView />
    </div>
  )
}
