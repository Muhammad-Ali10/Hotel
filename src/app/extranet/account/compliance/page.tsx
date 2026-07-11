import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { compliance } from "@/data/extranet"
import { PageHeader, StatusPill, Icon } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export default function CompliancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance Center"
        subtitle="Track your regulatory compliance status"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/account" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {compliance.map((c) => (
          <Card key={c.id}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Icon
                    name={c.status === "Compliant" ? "ShieldCheck" : "Clock"}
                    className="size-5"
                  />
                </span>
                <StatusPill status={c.status} />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading text-base font-semibold">
                  {c.name}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {c.description}
                </p>
              </div>
              <p className="text-muted-foreground text-xs">
                Last reviewed: {c.lastReviewed}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
