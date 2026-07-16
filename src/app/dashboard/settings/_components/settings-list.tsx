"use client"

import * as React from "react"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"

import type { UserSettings } from "@/types"
import { useStore } from "@/store"
import { useSettings } from "@/store/selectors"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"

type ToggleRow = {
  id: keyof Pick<UserSettings, "emailNotifications" | "smsNotifications" | "marketing" | "twoFactor">
  title: string
  description: string
}

const toggles: ToggleRow[] = [
  {
    id: "emailNotifications",
    title: "Email Notifications",
    description: "Receive booking updates and promotions",
  },
  {
    id: "smsNotifications",
    title: "SMS Notifications",
    description: "Get text alerts for your bookings",
  },
  {
    id: "marketing",
    title: "Marketing Emails",
    description: "Special offers and travel inspiration",
  },
  {
    id: "twoFactor",
    title: "Two-Factor Authentication",
    description: "Add an extra layer of security",
  },
]

/**
 * Settings now persist. Each switch was previously a `defaultChecked` with no
 * handler, and the currency select changed no prices — it has been dropped
 * rather than left as a control that does nothing (the product prices in USD).
 */
export function SettingsList() {
  const settings = useSettings()
  const updateSettings = useStore((s) => s.updateSettings)
  const resetDemo = useStore((s) => s.resetDemo)

  return (
    <div className="space-y-4">
      {toggles.map((row) => (
        <Card key={row.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="font-heading text-sm font-medium">{row.title}</p>
              <p className="text-muted-foreground text-sm">{row.description}</p>
            </div>
            <div className="shrink-0">
              <Switch
                checked={settings[row.id]}
                onCheckedChange={(checked) => {
                  updateSettings({ [row.id]: checked === true })
                  toast.success(`${row.title} ${checked ? "on" : "off"}`)
                }}
                aria-label={row.title}
              />
            </div>
          </div>
        </Card>
      ))}

      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="font-heading text-sm font-medium">Currency</p>
            <p className="text-muted-foreground text-sm">
              All prices are shown and charged in {settings.currency}.
            </p>
          </div>
        </div>
      </Card>

      {/* Demo control — everything in this build is stored in the browser */}
      <Card className="border-destructive/30 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="font-heading text-sm font-medium">Reset demo data</p>
            <p className="text-muted-foreground text-sm">
              Clears bookings, reviews and favourites saved in this browser and restores
              the original sample data.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              resetDemo()
              toast.success("Demo data reset.")
            }}
          >
            <RotateCcw className="size-3.5" />
            Reset
          </Button>
        </div>
      </Card>
    </div>
  )
}
