import { hotels } from "@/data"
import { HeroSearch } from "@/components/marketplace/hero-search"
import { HotelsBrowser } from "./_components/hotels-browser"

export default async function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>
}) {
  const { city } = await searchParams
  const cityName = city?.trim() || "Dubai"

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      {/* SEARCH BAR */}
      <HeroSearch
        initialLocation={cityName}
        glow={false}
        className="max-w-none"
      />

      {/* PAGE HEAD + LAYOUT (filters + results) */}
      <div className="mt-8">
        <HotelsBrowser hotels={hotels} city={cityName} />
      </div>
    </div>
  )
}
