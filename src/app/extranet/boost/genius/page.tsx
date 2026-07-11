import Link from "next/link"
import { Check, ChevronLeft } from "lucide-react"

import { geniusTiers } from "@/data/extranet"
import { cn } from "@/lib/utils"
import { ConfirmDialog, PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

export default function GeniusPartnerPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Genius Partner Program"
        subtitle="Offer Genius discounts to reach millions of loyal travelers"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/boost" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        {geniusTiers.map((t) => (
          <Card
            key={t.id}
            className={cn(t.current && "ring-2 ring-foreground")}
          >
            <CardContent className="flex h-full flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-base font-semibold">
                  {t.level}
                </h3>
                {t.current ? <Badge>Current</Badge> : null}
              </div>
              <p className="font-heading text-3xl font-semibold">
                {t.discount}
              </p>
              <ul className="flex-1 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {t.current ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="w-full"
                >
                  Current Level
                </Button>
              ) : (
                <ConfirmDialog
                  trigger={
                    <Button size="sm" className="w-full">
                      Upgrade
                    </Button>
                  }
                  title="Join Genius?"
                  description={`Enrol in ${t.level} and offer a ${t.discount} Genius discount to reach millions of loyal travelers.`}
                  confirmLabel="Join Genius"
                  toastMessage="Enrolled in Genius programme"
                />
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
