import type { Metadata } from "next"

import { ModifyBooking } from "../_components/modify-booking"

export const metadata: Metadata = {
  title: "Modify Booking — Stayora",
  description: "Update the details of one of your hotel reservations.",
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ModifyBooking id={id} />
}
