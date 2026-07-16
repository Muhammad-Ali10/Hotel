import type { Metadata } from "next"

import { getHotel, hotels } from "@/data"
import { HotelDetail } from "./_components/hotel-detail"

export function generateStaticParams() {
  return hotels.map((h) => ({ id: h.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const hotel = getHotel(id)
  if (!hotel) return { title: "Hotel not found — Stayora" }
  return {
    title: `${hotel.name}, ${hotel.city} — Stayora`,
    description: hotel.description.slice(0, 155),
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <HotelDetail id={id} />
}
