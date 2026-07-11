import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { messagingPreferences } from "@/data/extranet"
import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { MessagingPreferencesTable } from "./_components/messaging-preferences-table"

export default function MessagingPreferencesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Messaging Preferences"
        subtitle="Control how and when you receive notifications"
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

      <MessagingPreferencesTable preferences={messagingPreferences} />
    </div>
  )
}
