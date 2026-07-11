import { opportunities } from "@/data/extranet"
import {
  ActionButton,
  ConfirmDialog,
  PageHeader,
  StatusPill,
  Icon,
} from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { BoostNav } from "./_components/boost-nav"

function impactTone(impact: "High" | "Medium" | "Low") {
  return impact === "High" ? "success" : impact === "Medium" ? "warning" : "neutral"
}

export default function BoostPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Opportunity Center"
        subtitle={`${opportunities.length} opportunities identified for your properties`}
      />

      <BoostNav />

      <h2 className="font-heading text-lg font-semibold tracking-tight">
        Opportunities
      </h2>

      <div className="grid gap-6 sm:grid-cols-2">
        {opportunities.map((op) => (
          <Card key={op.id}>
            <CardContent className="flex h-full flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <span className="bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <Icon name={op.icon} className="size-5" />
                </span>
                <StatusPill
                  status={`${op.impact} Impact`}
                  tone={impactTone(op.impact)}
                />
              </div>
              <div className="space-y-1">
                <h3 className="font-heading text-base font-semibold">
                  {op.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {op.description}
                </p>
              </div>
              <div className="mt-auto flex gap-2 pt-2">
                <ActionButton
                  size="sm"
                  toastMessage={op.cta}
                  toastDescription={op.title}
                >
                  Take Action
                </ActionButton>
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="sm">
                      Dismiss
                    </Button>
                  }
                  title="Dismiss opportunity?"
                  description={`"${op.title}" will be removed from your Opportunity Center.`}
                  confirmLabel="Dismiss"
                  destructive
                  toastMessage="Dismissed"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
