"use client"

import * as React from "react"
import Image from "next/image"
import { toast } from "sonner"

import { dashboardUser } from "@/data"
import { avatarImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

const fields = [
  {
    id: "firstName",
    label: "First Name",
    type: "text",
    autoComplete: "given-name",
    defaultValue: "John",
  },
  {
    id: "lastName",
    label: "Last Name",
    type: "text",
    autoComplete: "family-name",
    defaultValue: "Doe",
  },
  {
    id: "email",
    label: "Email",
    type: "email",
    autoComplete: "email",
    defaultValue: dashboardUser.email,
  },
  {
    id: "phone",
    label: "Phone",
    type: "tel",
    autoComplete: "tel",
    defaultValue: dashboardUser.phone,
  },
] as const

const preferences = [
  "Luxury",
  "Business",
  "Family",
  "Beach",
  "City",
  "Spa",
] as const

export function ProfileForm() {
  const [selected, setSelected] = React.useState<string[]>([
    "Luxury",
    "City",
    "Spa",
  ])

  function togglePreference(preference: string) {
    setSelected((current) =>
      current.includes(preference)
        ? current.filter((item) => item !== preference)
        : [...current, preference]
    )
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    toast.success("Profile updated")
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <Image
              src={avatarImage(dashboardUser.seed, 128)}
              alt={dashboardUser.name}
              width={64}
              height={64}
              className="size-16 shrink-0 rounded-full object-cover ring-1 ring-foreground/10"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <p className="font-heading text-lg font-semibold">
                  {dashboardUser.name}
                </p>
                <Badge>Gold Member</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                {dashboardUser.email}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={field.id}>{field.label}</Label>
                <Input
                  id={field.id}
                  name={field.id}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  defaultValue={field.defaultValue}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Travel Preferences</Label>
            <div className="flex flex-wrap gap-2">
              {preferences.map((preference) => {
                const isSelected = selected.includes(preference)
                return (
                  <button
                    key={preference}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => togglePreference(preference)}
                    className={cn(
                      "rounded-full px-3 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {preference}
                  </button>
                )
              })}
            </div>
          </div>

          <Button type="submit" size="lg">
            Save Changes
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
