import type { Metadata } from "next"

import { SettingsList } from "./_components/settings-list"

export const metadata: Metadata = {
  title: "Settings — Stayora",
  description:
    "Manage your notification preferences and travel preferences.",
}

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        Settings
      </h1>

      <SettingsList />
    </div>
  )
}
