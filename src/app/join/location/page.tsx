"use client"

import * as React from "react"
import { MapPin } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"

const countries = [
  { value: "Pakistan", label: "Pakistan" },
  { value: "United Arab Emirates", label: "United Arab Emirates" },
  { value: "Saudi Arabia", label: "Saudi Arabia" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "United States", label: "United States" },
]

export default function LocationPage() {
  const { data, update } = useWizard()
  const [form, setForm] = React.useState({
    street: data.street,
    city: data.city,
    state: data.state,
    zip: data.zip,
    country: data.country,
  })

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  function validate() {
    if (!form.street.trim() || !form.city.trim() || !form.zip.trim()) {
      toast.error("Please fill in the required address fields")
      return false
    }
    update(form)
    return true
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Why location matters">
          Your address determines where your property appears in search results.
          Travelers filter by city, neighborhood, and landmarks. An accurate
          address helps you get booked by the right guests. You can refine your
          exact map pin later in the Extranet.
        </TipPanel>
      }
    >
      <StepHeading
        title="Where is your property located?"
        description="Your address helps guests find you and determines your property's ranking in local searches."
      />
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="street">
            Street address <span className="text-destructive">*</span>
          </Label>
          <Input
            id="street"
            placeholder="e.g. 42-A, Mall Road"
            value={form.street}
            onChange={(e) => set("street")(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">
              City <span className="text-destructive">*</span>
            </Label>
            <Input
              id="city"
              placeholder="e.g. Lahore"
              value={form.city}
              onChange={(e) => set("city")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">State / Province</Label>
            <Input
              id="state"
              placeholder="e.g. Punjab"
              value={form.state}
              onChange={(e) => set("state")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zip">
              ZIP / Postal code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="zip"
              placeholder="e.g. 54000"
              value={form.zip}
              onChange={(e) => set("zip")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">
              Country <span className="text-destructive">*</span>
            </Label>
            <Select
              items={countries}
              value={form.country}
              onValueChange={(v) => set("country")(v as string)}
            >
              <SelectTrigger id="country" className="w-full" size="default">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {countries.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Your location on the map</Label>
          <div className="bg-muted/50 text-muted-foreground flex h-40 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-sm">
            <MapPin className="size-6" />
            <span>{form.city ? `${form.city}, ${form.country}` : "Map preview"}</span>
          </div>
        </div>
      </div>

      <StepNav slug="location" onContinue={validate} />
    </WizardShell>
  )
}
