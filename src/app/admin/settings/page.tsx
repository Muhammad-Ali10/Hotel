import type { Metadata } from "next"

import { SettingsView } from "./_components/settings-view"

export const metadata: Metadata = { title: "Settings · Stayora Admin" }

export default function AdminSettingsPage() {
  return <SettingsView />
}
