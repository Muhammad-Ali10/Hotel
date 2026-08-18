import type { Metadata } from "next"

import { ContentView } from "./_components/content-view"

export const metadata: Metadata = {
  title: "Content & Descriptions · Stayora Admin",
}

export default function AdminContentPage() {
  return <ContentView />
}
