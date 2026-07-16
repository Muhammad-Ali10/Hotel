"use client"

import { useFavoriteHotels } from "@/store/selectors"
import { FavoriteCard } from "./favorite-card"
import { EmptyFavorites } from "./empty-favorites"

/** Reads what the guest actually saved. The page used to render
 *  `hotels.slice(0, 6)` — six properties nobody had picked, above a stat tile
 *  that claimed four. */
export function FavoritesGrid() {
  const savedHotels = useFavoriteHotels()

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Saved Hotels
        </h1>
        <p className="text-muted-foreground text-sm">
          {savedHotels.length} {savedHotels.length === 1 ? "property" : "properties"}
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
