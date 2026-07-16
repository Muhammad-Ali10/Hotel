"use client"

import * as React from "react"
import Image from "next/image"
import { Camera } from "lucide-react"
import { toast } from "sonner"

import { avatarImage } from "@/lib/images"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useStore } from "@/store"
import { useProfile } from "@/store/selectors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

const preferences = ["Luxury", "Business", "Family", "Beach", "City", "Spa"] as const

/** Avatar options stand in for an upload — the profile displayed a photo with
 *  no control anywhere to change it. */
const avatarSeeds = ["john-doe", "traveller-2", "traveller-3", "traveller-4", "traveller-5"]

export function ProfileForm() {
  const profile = useProfile()
  const updateProfile = useStore((s) => s.updateProfile)

  const [form, setForm] = React.useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    country: profile.country,
    city: profile.city,
    avatarSeed: profile.avatarSeed,
    preferences: profile.preferences,
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  function togglePreference(preference: string) {
    set({
      preferences: form.preferences.includes(preference)
        ? form.preferences.filter((p) => p !== preference)
        : [...form.preferences, preference],
    })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    updateProfile(form)
    toast.success("Profile updated")
  }

  const fields = [
    { id: "firstName", label: "First Name", type: "text", autoComplete: "given-name" },
    { id: "lastName", label: "Last Name", type: "text", autoComplete: "family-name" },
    { id: "email", label: "Email", type: "email", autoComplete: "email" },
    { id: "phone", label: "Phone", type: "tel", autoComplete: "tel" },
    { id: "country", label: "Country", type: "text", autoComplete: "country-name" },
    { id: "city", label: "City", type: "text", autoComplete: "address-level2" },
  ] as const

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <Image
              src={avatarImage(form.avatarSeed, 128)}
              alt={`${form.firstName} ${form.lastName}`}
              width={64}
              height={64}
              className="ring-foreground/10 size-16 shrink-0 rounded-full object-cover ring-1"
            />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-col items-center gap-2 sm:flex-row">
                <p className="font-heading text-lg font-semibold">
                  {form.firstName} {form.lastName}
                </p>
                <Badge>{profile.membership}</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                Member since {formatDate(profile.joined)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Camera className="size-3.5" />
              Profile photo
            </Label>
            <div className="flex flex-wrap gap-2">
              {avatarSeeds.map((seed) => (
                <button
                  key={seed}
                  type="button"
                  aria-label={`Use avatar ${seed}`}
                  aria-pressed={form.avatarSeed === seed}
                  onClick={() => set({ avatarSeed: seed })}
                  className={cn(
                    "rounded-full ring-2 transition",
                    form.avatarSeed === seed
                      ? "ring-primary"
                      : "opacity-70 ring-transparent hover:opacity-100"
                  )}
                >
                  <Image
                    src={avatarImage(seed, 80)}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 rounded-full object-cover"
                  />
                </button>
              ))}
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
                  value={form[field.id]}
                  onChange={(e) => set({ [field.id]: e.target.value })}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Travel Preferences</Label>
            <div className="flex flex-wrap gap-2">
              {preferences.map((preference) => {
                const isSelected = form.preferences.includes(preference)
                return (
                  <button
                    key={preference}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => togglePreference(preference)}
                    className={cn(
                      "focus-visible:ring-ring/50 rounded-full px-3 py-1 text-sm font-medium transition-colors outline-none focus-visible:ring-3",
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
