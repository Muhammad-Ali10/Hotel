import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { promotionTemplates } from "@/data/extranet"
import { formatNumber } from "@/lib/format"
import { PageHeader, StatusPill } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PromotionCardActions } from "./_components/promotion-card-actions"

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}

export default function ChoosePromotionPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Choose New Promotion"
        subtitle="Select and apply a promotion to boost your bookings"
      >
        <Button
          variant="outline"
          size="sm"
          render={<Link href="/extranet/promotions" />}
        >
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {promotionTemplates.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex h-full flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="font-heading text-base font-semibold">
                    {p.name}
                  </h3>
                  <p className="font-heading text-2xl font-semibold">
                    {p.discount}
                  </p>
                </div>
                <StatusPill status={p.status} />
              </div>

              <div className="space-y-2 border-t pt-3 text-sm">
                <Meta label="Type" value={p.type} />
                <Meta label="Min stay" value={p.minStay} />
                <Meta label="Booking window" value={p.bookingWindow} />
                <Meta label="Validity" value={p.validity} />
              </div>

              {p.uses > 0 ? (
                <p className="text-muted-foreground text-xs">
                  {formatNumber(p.uses)} bookings via this promo
                </p>
              ) : null}

              <PromotionCardActions template={p} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
