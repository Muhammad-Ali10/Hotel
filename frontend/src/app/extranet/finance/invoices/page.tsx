import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { InvoicesView } from "./_components/invoices-view"

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" subtitle="SUBInvoices">
        <Button variant="outline" size="sm" render={<Link href="/extranet/finance" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <InvoicesView />
    </div>
  )
}
