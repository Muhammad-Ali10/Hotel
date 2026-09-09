"use client"

import Link from "next/link"

import { formatCurrency } from "@/lib/format"
import { usePropertyRatePlans } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { Icon, StatusPill } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NotFoundCard } from "@/components/shared/not-found-card"

/** Where each part of a plan is actually changed. */
const ACTIONS = [
  { label: "Calendar", href: "/extranet/rates/calendar" },
  { label: "Restrictions", href: "/extranet/rates/restrictions" },
  { label: "Per guest", href: "/extranet/rates/pricing-per-guest" },
]

/**
 * What this property sells, and on what terms.
 *
 * A rate plan is the unit everything else on this section hangs off: the
 * calendar prices one, restrictions bind one, per-guest pricing adjusts one.
 * The grid used to list six invented plans with a Create dialog and per-card
 * actions that toasted, so none of those screens could say which plan they
 * meant.
 *
 * There is no create or delete here, deliberately. Creating a plan MEANS
 * setting the terms a guest agrees to — the cancellation policy and the
 * payment mode — so the API gives it to an organisation admin only, and a
 * button that 403s for most of the team is worse than no button. Retiring one
 * is `status: "archived"`; a booking sold on it still has to explain itself.
 */
export function RatePlansGrid() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const plans = usePropertyRatePlans(active?.id ?? "")

  if (loadingProperties || plans.isPending) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-64 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (!active) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to see its rate plans."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  if (plans.error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {plans.error.message}
      </div>
    )
  }

  const list = plans.data ?? []

  if (list.length === 0) {
    return (
      <NotFoundCard
        title="No rate plans yet"
        description="Nothing on this property can be booked until a room has one."
        href="/extranet/property/room-types"
        cta="Room types"
      />
    )
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {list.map((plan) => (
        <Card key={plan.id} className={plan.status === "active" ? undefined : "opacity-60"}>
          <CardContent className="flex h-full flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <h3 className="font-heading text-base font-semibold">{plan.name}</h3>
                <div className="flex flex-wrap gap-1.5">
                  <StatusPill status={plan.status} />
                  {plan.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                </div>
              </div>
            </div>

            <p className="font-heading text-2xl font-semibold">
              {formatCurrency(plan.basePrice)}
              <span className="text-muted-foreground text-sm font-normal"> / night</span>
            </p>

            <ul className="text-muted-foreground space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <Icon name="BedDouble" className="size-4 shrink-0 translate-y-0.5" />
                {plan.roomName}
                <span className="text-muted-foreground">
                  · {plan.roomUnits} {plan.roomUnits === 1 ? "unit" : "units"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Icon name="CalendarClock" className="size-4 shrink-0 translate-y-0.5" />
                {plan.cancellationText}
              </li>
              <li className="flex items-start gap-2">
                <Icon name="CreditCard" className="size-4 shrink-0 translate-y-0.5" />
                {plan.paymentMode === "prepay"
                  ? "Charged at booking"
                  : "Card held, charged at the property"}
              </li>
              <li className="flex items-start gap-2">
                <Icon name="CalendarDays" className="size-4 shrink-0 translate-y-0.5" />
                {plan.defaultMinStay} night minimum
                {plan.defaultMaxStay ? `, ${plan.defaultMaxStay} maximum` : ""}
              </li>
            </ul>

            {plan.inclusions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {plan.inclusions.map((i) => (
                  <Badge key={i} variant="secondary">
                    {i}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="mt-auto flex flex-wrap gap-2 pt-2">
              {ACTIONS.map((action) => (
                <Button
                  key={action.href}
                  variant="outline"
                  size="xs"
                  render={<Link href={action.href}>{action.label}</Link>}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
