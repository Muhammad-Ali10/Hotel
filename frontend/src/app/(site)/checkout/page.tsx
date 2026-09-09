import type { Metadata } from "next"
import Link from "next/link"

import { addDays, toISODate } from "@/lib/domain"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { NotFoundCard } from "@/components/shared/not-found-card"
import { CheckoutFlow } from "./_components/checkout-flow"

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your booking.",
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

/**
 * Checkout.
 *
 * The page no longer looks the hotel up — it cannot, because the catalogue is
 * a live API and this is a server component with no session. It validates that
 * a selection was passed at all and hands it to the client, which fetches the
 * property and takes a fresh quote against the guest's own tier (rule #3): the
 * price depends on WHO is booking, and only the browser carries the cookie
 * that says.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const slug = first(sp.hotel) ?? ""
  const roomId = first(sp.room) ?? ""
  const ratePlanId = first(sp.plan) ?? ""

  // A selection, or nothing to check out. The room and the rate plan are both
  // required: the rate plan decides what this costs and whether the card is
  // charged today (rule #42), and guessing one for the guest is how somebody
  // ends up on a non-refundable rate they never picked.
  if (!slug || !roomId || !ratePlanId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <NotFoundCard
          title="Nothing to check out"
          description="Pick a property, your dates and a rate to start a booking."
          href="/hotels"
          cta="Browse hotels"
        />
      </div>
    )
  }

  const today = toISODate(new Date())
  const checkIn = first(sp.checkin) ?? addDays(today, 1)
  const checkOut = first(sp.checkout) ?? addDays(checkIn, 2)
  const guests = Number(first(sp.guests)) || 2

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/">Home</Link>} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href={`/hotels/${slug}`}>Hotel</Link>} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Checkout</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <h1 className="font-heading mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
        Complete Your Booking
      </h1>

      <div className="mt-6">
        <CheckoutFlow
          slug={slug}
          roomId={roomId}
          ratePlanId={ratePlanId}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
        />
      </div>
    </div>
  )
}
