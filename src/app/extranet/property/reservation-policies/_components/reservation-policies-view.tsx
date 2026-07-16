"use client"

import Link from "next/link"
import { ExternalLink, Pencil } from "lucide-react"

import { formatCurrency } from "@/lib/format"
import { formatTime24 } from "@/lib/domain"
import { useActiveHotel } from "@/store/selectors"
import { Icon } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { NotFoundCard } from "@/components/shared/not-found-card"

/**
 * A read-only summary of the rules a guest agrees to at booking. It reads the
 * same policy record the Policies screen edits — this page used to restate the
 * rules in its own words, and disagreed with both the property page and the
 * public listing about the check-out time.
 */
export function ReservationPoliciesView() {
  const hotel = useActiveHotel()

  if (!hotel) {
    return (
      <NotFoundCard
        title="No active property"
        description="Choose a property to review its reservation policies."
        href="/extranet/properties"
        cta="View portfolio"
      />
    )
  }

  const { policies, availability, taxLines } = hotel
  const addedAtCheckout = taxLines.filter((t) => t.active && !t.includedInDisplayPrice)

  const cards = [
    {
      icon: "Clock",
      title: "Check-in",
      value: `From ${formatTime24(policies.checkInTime)}`,
      detail: "Guests choose an estimated arrival window at checkout.",
    },
    {
      icon: "Clock",
      title: "Check-out",
      value: `Until ${formatTime24(policies.checkOutTime)}`,
      detail: "Late check-out can be sold as a value-add.",
    },
    {
      icon: "Ban",
      title: "Cancellation",
      value: "Policy applied automatically",
      detail: policies.cancellation,
    },
    {
      icon: "CreditCard",
      title: "Payment",
      value: "Card or pay at property",
      detail: policies.payment,
    },
    {
      icon: "PawPrint",
      title: "Pets",
      value: policies.pets.toLowerCase().startsWith("pets allowed") ? "Allowed" : "See policy",
      detail: policies.pets,
    },
    {
      icon: "Cigarette",
      title: "Smoking",
      value: "Non-smoking",
      detail: policies.smoking,
    },
    {
      icon: "Baby",
      title: "Children",
      value: "Welcome",
      detail: policies.children,
    },
    {
      icon: "CalendarDays",
      title: "Minimum stay",
      value: `${availability.minStay} ${availability.minStay === 1 ? "night" : "nights"}`,
      detail: "Set in Rates → Restrictions. Enforced in the public date picker.",
    },
    {
      icon: "Receipt",
      title: "Charges at checkout",
      value: `${addedAtCheckout.length} line${addedAtCheckout.length === 1 ? "" : "s"}`,
      detail: addedAtCheckout.map((t) => t.label).join(" · ") || "None configured.",
    },
    {
      icon: "Wallet",
      title: "Lowest nightly rate",
      value: formatCurrency(hotel.pricePerNight),
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
          href={`/hotels/${hotel.id}`}
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
    </>
  )
}
