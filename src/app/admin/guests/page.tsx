import type { Metadata } from "next"

import { GuestsView } from "./_components/guests-view"

export const metadata: Metadata = { title: "Guests · Stayora Admin" }

export default function AdminGuestsPage() {
  return <GuestsView />
}
