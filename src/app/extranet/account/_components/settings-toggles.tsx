"use client"

import { toast } from "sonner"

import { useStore } from "@/store"
import { Switch } from "@/components/ui/switch"

/**
 * Partner preference toggles. These were local `useState` seeded from a static
 * array — flip one, navigate away, and it was back. They now persist like the
 * customer's settings do.
 */
export function SettingsToggles({ ids }: { ids: string[] }) {
  const settings = useStore((s) => s.partnerSettings)
  const setPartnerSetting = useStore((s) => s.setPartnerSetting)
  const rows = settings.filter((s) => ids.includes(s.id))

  return (
    <ul className="divide-y">
      {rows.map((s) => (
        <li
          key={s.id}
          className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium">{s.label}</p>
            <p className="text-muted-foreground text-xs">{s.description}</p>
          </div>
          <Switch
            checked={s.enabled}
            aria-label={s.label}
            onCheckedChange={(checked) => {
              setPartnerSetting(s.id, checked === true)
              toast.success(`${s.label} ${checked ? "on" : "off"}`)
            }}
          />
        </li>
      ))}
    </ul>
  )
}
