import type { Metadata } from "next"

import { ContentView } from "./_components/content-view"

export const metadata: Metadata = {
  title: "Content & Descriptions",
}

export default function AdminContentPage() {
  return <ContentView />
}
