import type { Metadata } from "next"

import { HotelDetail } from "./_components/hotel-detail"

/*
 * No `generateStaticParams`.
 *
 * The catalogue is now a live API, and pre-rendering a fixed list of hotels at
 * build time would mean a property approved on Tuesday is a 404 until the next
 * deploy. Rendered on demand instead.
 */

/**
 * Metadata, fetched on the server.
 *
 * A plain `fetch` rather than the API client: the client always sends
 * `credentials: "include"`, which is meaningless here — there is no browser and
 * no cookie — and this endpoint is public anyway.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"

  try {
    const response = await fetch(`${base}/properties/${encodeURIComponent(id)}`, {
      // Long enough that a crawler burst does not become a burst on the API,
      // short enough that a renamed hotel fixes itself the same day.
      next: { revalidate: 300 },
    })
    if (!response.ok) return { title: "Hotel not found" }

    const hotel = (await response.json()) as { name: string; city: string; description: string }
    return {
      title: `${hotel.name}, ${hotel.city}`,
      description: hotel.description.slice(0, 155),
    }
  } catch {
    // The API being down must not fail the render — the page itself will show
    // the guest a real error, which is more use than a broken build.
    return { title: "Stayora" }
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <HotelDetail id={id} />
}
