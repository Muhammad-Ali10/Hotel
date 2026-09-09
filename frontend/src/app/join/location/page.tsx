"use client"

import * as React from "react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDestinations } from "@/lib/api/hooks"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"

/**
 * Country is typed, not picked from a list.
 *
 * It was a select of five — Pakistan, the UAE, Saudi Arabia, the UK, the US —
 * on a marketplace whose live properties are in Bali, the Maldives and Zermatt.
 * A partner anywhere else could not enter their own country, and the field
 * defaulted to the top of the list, so an address in Dubai saved itself as
 * Pakistan if nobody noticed the dropdown.
 *
 * There is no country vocabulary in this system to pick from — `properties`
 * stores a plain string — so inventing one here would be a sixth. The
 * datalist suggests the countries the platform already lists in, and accepts
 * anything else.
 */
export default function LocationPage() {
  const { data, save } = useWizard()
  const destinations = useDestinations(24)

  const [form, setForm] = React.useState({
    street: data.street,
    city: data.city,
    state: data.state,
    zip: data.zip,
    country: data.country,
  })

  const knownCountries = React.useMemo(() => {
    const seen = new Set((destinations.data ?? []).map((d) => d.country))
    return [...seen].sort((a, b) => a.localeCompare(b))
  }, [destinations.data])

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  async function validate() {
    /*
     * Street, city and country — the three `submissionGaps` asks for. ZIP was
     * required here and is not required at submit; several of the countries
     * this marketplace lists in do not use postcodes at all.
     */
    if (!form.street.trim() || !form.city.trim() || !form.country.trim()) {
      toast.error("Street, city and country are needed")
      return false
    }
    return save({
      street: form.street.trim(),
      city: form.city.trim(),
      state: form.state.trim(),
      zip: form.zip.trim(),
      country: form.country.trim(),
    })
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Why location matters">
          Guests search by city, so this is what puts your property in front of
          them — and it is what the confirmation email tells them to travel to.
          Write the address as you would on a letter.
        </TipPanel>
      }
    >
      <StepHeading
        title="Where is your property located?"
        description="Guests search by city, and this address is what appears on their booking confirmation."
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
            <Label htmlFor="zip">ZIP / Postal code</Label>
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
            <Input
              id="country"
              list="join-countries"
              placeholder="e.g. United Arab Emirates"
              value={form.country}
              onChange={(e) => set("country")(e.target.value)}
            />
            <datalist id="join-countries">
              {knownCountries.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        {/* The "map preview" that used to sit here was a dashed box with a pin
            icon in it. There are no coordinates on a property in this system and
            no map anywhere in the product — it promised a pin the partner would
            be able to drag, and there was never anything to drag. */}
      </div>

      <StepNav slug="location" onContinue={validate} />
    </WizardShell>
  )
}
