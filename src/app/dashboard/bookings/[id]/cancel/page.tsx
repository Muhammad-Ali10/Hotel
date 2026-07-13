import type { Metadata } from "next"

import { getBooking } from "@/data"
import { CancelBooking } from "../_components/cancel-booking"

export const metadata: Metadata = {
  title: "Cancel Booking — Stayora",
  description: "Cancel one of your hotel reservations.",
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const booking = getBooking(id)
  return <CancelBooking booking={booking} />
}
