import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { DevicesView } from "./_components/devices-view"

export default function DevicesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Signed-in Devices"
        subtitle="Every session that can act as your account"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/account" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <DevicesView />
    </div>
  )
}
