import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { BookWindowView } from "./_components/book-window-view"

export default function BookWindowPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Booking Window" subtitle="SUBBooking Window">
        <Button variant="outline" size="sm" render={<Link href="/extranet/analytics" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <BookWindowView />
    </div>
  )
}
