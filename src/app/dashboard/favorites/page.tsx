import type { Metadata } from "next"

import { FavoritesGrid } from "./_components/favorites-grid"

export const metadata: Metadata = {
  title: "Saved Hotels — Stayora",
  description: "Properties you've saved for later.",
}

export default function FavoritesPage() {
  return <FavoritesGrid />
}
