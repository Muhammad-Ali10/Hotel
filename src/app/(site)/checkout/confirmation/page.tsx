import type { Metadata } from "next"

import { ConfirmationView } from "./_components/confirmation-view"

export const metadata: Metadata = {
  title: "Booking Confirmed — Stayora",
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
  return <ConfirmationView reference={first(sp.ref) ?? ""} />
}
