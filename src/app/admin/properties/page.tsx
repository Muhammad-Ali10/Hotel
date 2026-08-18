import type { Metadata } from "next"

import { PropertiesView } from "./_components/properties-view"

export const metadata: Metadata = { title: "Properties · Stayora Admin" }

export default function AdminPropertiesPage() {
  return <PropertiesView />
}
