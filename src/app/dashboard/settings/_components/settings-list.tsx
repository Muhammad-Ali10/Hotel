"use client"

import * as React from "react"

import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SettingRow = {
  id: string
  title: string
  description: string
  control: React.ReactNode
}

const currencyOptions = [
  { value: "usd", label: "USD ($)" },
  { value: "eur", label: "EUR (€)" },
  { value: "gbp", label: "GBP (£)" },
  { value: "pkr", label: "PKR (₨)" },
]

export function SettingsList() {
  const rows: SettingRow[] = [
    {
      id: "email",
      title: "Email Notifications",
      description: "Receive booking updates and promotions",
      control: (
        <Switch defaultChecked aria-label="Email Notifications" />
      ),
    },
    {
      id: "sms",
      title: "SMS Notifications",
      description: "Get text alerts for your bookings",
      control: <Switch aria-label="SMS Notifications" />,
    },
    {
      id: "marketing",
      title: "Marketing Emails",
      description: "Special offers and travel inspiration",
      control: <Switch aria-label="Marketing Emails" />,
    },
    {
      id: "two-factor",
      title: "Two-Factor Authentication",
      description: "Add an extra layer of security",
      control: <Switch aria-label="Two-Factor Authentication" />,
    },
    {
      id: "currency",
      title: "Currency",
      description: "Choose your preferred display currency",
      control: (
        <Select defaultValue="usd">
          <SelectTrigger aria-label="Currency" className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {currencyOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <Card key={row.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 space-y-0.5">
              <p className="font-heading text-sm font-medium">{row.title}</p>
              <p className="text-muted-foreground text-sm">
                {row.description}
              </p>
            </div>
            <div className="shrink-0">{row.control}</div>
          </div>
        </Card>
      ))}
    </div>
  )
}
