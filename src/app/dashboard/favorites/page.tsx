import { hotels } from "@/data"

import { FavoriteCard } from "./_components/favorite-card"
import { EmptyFavorites } from "./_components/empty-favorites"

export default function FavoritesPage() {
  const savedHotels = hotels.slice(0, 6)

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Saved Hotels
        </h1>
        <p className="text-muted-foreground text-sm">
          {savedHotels.length}{" "}
          {savedHotels.length === 1 ? "property" : "properties"}
        </p>
      </div>

      {savedHotels.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {savedHotels.map((hotel) => (
            <FavoriteCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      ) : (
        <EmptyFavorites />
      )}
    </div>
  )
}
