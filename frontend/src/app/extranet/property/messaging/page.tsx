import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { MessagingPreferencesTable } from "./_components/messaging-preferences-table"

export default function MessagingPreferencesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Messaging Preferences"
        subtitle="Which messages reach you, and how"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/property" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <MessagingPreferencesTable />
    </div>
  )
}
