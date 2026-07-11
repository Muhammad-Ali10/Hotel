import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { reservationPolicies } from "@/data/extranet"
import { PageHeader, Icon } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function ReservationPoliciesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservation Policies"
        subtitle="Define the rules guests agree to when booking"
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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reservationPolicies.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon name={p.icon} className="size-4" />
                </span>
                <h3 className="font-heading text-sm font-semibold">{p.title}</h3>
              </div>
              <p className="font-heading text-base font-semibold">{p.value}</p>
              <p className="text-muted-foreground text-sm">{p.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
