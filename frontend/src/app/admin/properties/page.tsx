import type { Metadata } from "next"

import { PropertiesView } from "./_components/properties-view"

export const metadata: Metadata = { title: "Properties" }

export default function AdminPropertiesPage() {
  return <PropertiesView />
}
