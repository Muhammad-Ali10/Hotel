"use client"

import Link from "next/link"
import { ExternalLink, Pencil } from "lucide-react"

import { formatCurrency } from "@/lib/format"
import { formatTime24 } from "@/lib/domain"
import { useListing, usePropertyRatePlans } from "@/lib/api/hooks"
import { useActiveProperty } from "@/components/extranet/active-property"
import { Icon } from "@/components/extranet/shared"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { NotFoundCard } from "@/components/shared/not-found-card"

/**
 * A read-only summary of what a guest actually agrees to at booking.
 *
 * Three things here used to be written rather than read:
 *
 *   - **"Non-smoking" and "Children: Welcome"** were printed as headlines
 *     regardless of the policy text underneath them, so a property that allows
 *     smoking said it did not. The rule's own words are the headline now.
 *   - **"Cancellation: policy applied automatically"** was a single line on
 *     the property. Cancellation belongs to a RATE PLAN (rule #1) — a
 *     non-refundable rate and a flexible one sit on the same room — so every
 *     plan is listed with the terms it really carries.
 *   - **Minimum stay** was one number for the hotel. It is per plan too.
 */
export function ReservationPoliciesView() {
  const { active, isPending: loadingProperties } = useActiveProperty()
  const listing = useListing(active?.id ?? "")
  const plans = usePropertyRatePlans(active?.id ?? "")

  if (loadingProperties || listing.isPending) {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-muted h-36 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  const hotel = listing.data

  if (!active || !hotel) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to review its reservation policies."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const livePlans = (plans.data ?? []).filter((p) => p.status === "active")
  const minStays = livePlans.map((p) => p.defaultMinStay)
  const minStay = minStays.length > 0 ? Math.min(...minStays) : null
  const maxMinStay = minStays.length > 0 ? Math.max(...minStays) : null

  const cards = [
    {
      icon: "Clock",
      title: "Check-in",
      value: `From ${formatTime24(hotel.checkInTime)}`,
      detail: "Guests choose an estimated arrival window at checkout.",
    },
    {
      icon: "Clock",
      title: "Check-out",
      value: `Until ${formatTime24(hotel.checkOutTime)}`,
      detail: "Late check-out can be sold as a value-add.",
    },
    {
      icon: "CreditCard",
      title: "Payment",
      value: hotel.policyPayment || "Not set",
      detail: "Whether a card is charged now or held for arrival is set per rate plan.",
    },
    {
      icon: "PawPrint",
      title: "Pets",
      value: hotel.policyPets || "Not set",
      detail: "Shown on your listing and on the booking confirmation.",
    },
    {
      icon: "Cigarette",
      title: "Smoking",
      value: hotel.policySmoking || "Not set",
      detail: "Shown on your listing and on the booking confirmation.",
    },
    {
      icon: "Baby",
      title: "Children & cots",
      value: hotel.policyChildren || "Not set",
      detail: "Shown on your listing and on the booking confirmation.",
    },
    {
      icon: "CalendarDays",
      title: "Minimum stay",
      value:
        minStay === null
          ? "—"
          : minStay === maxMinStay
            ? `${minStay} ${minStay === 1 ? "night" : "nights"}`
            : `${minStay}–${maxMinStay} nights`,
      detail:
        minStay === null
          ? "No active rate plan to read it from."
          : "Set per rate plan, and overridable night by night in Rates.",
    },
    {
      icon: "Receipt",
      title: "Charges at checkout",
      // Nothing is added on top of a rate (rule #11). This used to count tax
      // lines that no part of the quote, the total or the payout ever read.
      value: "None",
      detail: "Your rate is the final price — nothing is added at checkout.",
    },
    {
      icon: "Wallet",
      title: "Lowest nightly rate",
      value:
        livePlans.length === 0
          ? "—"
          : formatCurrency(Math.min(...livePlans.map((p) => p.basePrice)) / 100),
      detail: "The rate quoted as “From” on your public listing.",
    },
  ]

  return (
    <>
      <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
        <span>Edit these on the Policies screen — this page reflects what guests agree to.</span>
        <Link
          href="/extranet/property/policies"
          className="text-foreground inline-flex items-center gap-1 hover:underline"
        >
          <Pencil className="size-3" /> Edit policies
        </Link>
        <Link
          href={`/hotels/${hotel.slug}`}
          target="_blank"
          className="text-foreground inline-flex items-center gap-1 hover:underline"
        >
          View listing <ExternalLink className="size-3" />
        </Link>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((p) => (
          <Card key={p.title}>
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

      {/*
       * Cancellation, per plan.
       *
       * The text is generated from the very fields the refund is computed
       * from, so what a guest reads here and what they are actually charged
       * cannot drift apart.
       */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-heading text-base font-semibold">Cancellation, by rate plan</h2>
          <Link
            href="/extranet/rates"
            className="text-muted-foreground text-sm hover:underline"
          >
            Manage rates
          </Link>
        </div>

        {plans.isPending ? (
          <div className="bg-muted h-24 animate-pulse rounded-xl" aria-busy="true" />
        ) : plans.error ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
            {plans.error.message}
          </div>
        ) : livePlans.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground text-sm">
              No active rate plan yet — nothing on this property can be booked until one exists.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {livePlans.map((plan) => (
              <Card key={plan.id}>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-heading text-sm font-semibold">{plan.name}</h3>
                    {plan.isDefault ? <Badge variant="secondary">Default</Badge> : null}
                    <Badge variant="outline">{plan.roomName}</Badge>
                  </div>
                  <p className="font-heading text-base font-semibold">
                    {formatCurrency(plan.basePrice)}
                    <span className="text-muted-foreground text-xs font-normal"> / night</span>
                  </p>
                  <p className="text-muted-foreground text-sm">{plan.cancellationText}</p>
                  {plan.inclusions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {plan.inclusions.map((i) => (
                        <Badge key={i} variant="secondary">
                          {i}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
