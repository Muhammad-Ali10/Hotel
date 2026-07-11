import { ratePlans } from "@/data/extranet"
import { formatCurrency } from "@/lib/format"
import { PageHeader, StatusPill, Icon } from "@/components/extranet/shared"
import { Card, CardContent } from "@/components/ui/card"
import { CreatePlanDialog } from "./_components/create-plan-dialog"
import {
  RatePlanActions,
  RatePlanQuickActions,
} from "./_components/rate-plan-actions"

const activeCount = ratePlans.filter((p) => p.status === "Active").length

export default function RatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Rate Plans"
        subtitle={`${ratePlans.length} plans · ${activeCount} active`}
      >
        <CreatePlanDialog />
      </PageHeader>

      <section>
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {ratePlans.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <h3 className="font-heading text-base font-semibold">
                      {p.name}
                    </h3>
                    <StatusPill status={p.status} />
                  </div>
                  <RatePlanActions plan={p} />
                </div>

                <p className="font-heading text-2xl font-semibold">
                  {formatCurrency(p.price)}
                  <span className="text-muted-foreground text-sm font-normal">
                    {" "}
                    / night
                  </span>
                </p>

                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Icon name="CalendarClock" className="size-4 shrink-0" />
                    {p.cancellation}
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="Sparkles" className="size-4 shrink-0" />
                    {p.inclusion}
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="BedDouble" className="size-4 shrink-0" />
                    {p.roomTypes} room types
                  </li>
                </ul>

                <RatePlanQuickActions plan={p} />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
