import type { Metadata } from "next"

import { ConfirmationView } from "./_components/confirmation-view"

export const metadata: Metadata = {
  title: "Booking Confirmed",
  description: "Your reservation is confirmed.",
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  /*
   * The booking ID, not a reference string.
   *
   * `ref` is the guest-facing code (`STY-8K82CD`) and there is no endpoint
   * that looks one up — the API answers on the id, and checkout has it.
   */
  return <ConfirmationView bookingId={first(sp.booking) ?? ""} />
}
