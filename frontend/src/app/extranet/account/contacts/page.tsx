import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { ContactsView } from "./_components/contacts-view"

export default function ContactsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacts"
        subtitle="Who answers for this account, and about what"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/account" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <ContactsView />
    </div>
  )
}
