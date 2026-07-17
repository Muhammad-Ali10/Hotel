"use client"

import * as React from "react"
import {
  Building,
  Building2,
  BedDouble,
  Car,
  Coffee,
  Hotel,
  House,
  TreePalm,
} from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { SelectCard } from "../_components/select-card"
import { useWizard } from "../_components/wizard-provider"
import type { PropertyType } from "../_lib/types"

const types: { value: PropertyType; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "hotel", label: "Hotel", desc: "Traditional hotel with rooms and services", icon: Hotel },
  { value: "resort", label: "Resort", desc: "Leisure property with recreational facilities", icon: TreePalm },
  { value: "guesthouse", label: "Guesthouse", desc: "Small, owner-operated lodging", icon: House },
  { value: "hostel", label: "Hostel", desc: "Budget accommodations with shared spaces", icon: BedDouble },
  { value: "apartment", label: "Apartment", desc: "Self-contained rental unit", icon: Building2 },
  { value: "villa", label: "Villa", desc: "Standalone luxury private residence", icon: Building },
  { value: "bnb", label: "Bed & Breakfast", desc: "Overnight stay with breakfast included", icon: Coffee },
  { value: "motel", label: "Motel", desc: "Roadside lodging for motorists", icon: Car },
]

export default function PropertyTypePage() {
  const { data, update } = useWizard()
  const [name, setName] = React.useState(data.propertyName)
  const [type, setType] = React.useState<PropertyType | null>(data.propertyType)

  function validate() {
    if (!name.trim()) {
      toast.error("Please enter a property name")
      return false
    }
    if (!type) {
      toast.error("Please choose a property type")
      return false
    }
    update({ propertyName: name.trim(), propertyType: type })
    return true
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Choosing the right type">
          Your property type helps travelers find exactly what they&apos;re
          looking for. It affects how your property appears in search results and
          which filters apply. Choose the one that best matches your offering —
          you can adjust this later in the Extranet.
        </TipPanel>
      }
    >
      <StepHeading
        title="Tell us about your property"
        description="Give your property a name and choose the type that best describes it."
      />
      <div className="space-y-2">
        <Label htmlFor="propertyName">
          Property name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="propertyName"
          placeholder="e.g. Grand Horizon Resort & Spa"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          This is how guests will find your property. You can change it later.
        </p>
      </div>

      <div className="mt-6 space-y-2">
        <Label>
          Property type <span className="text-destructive">*</span>
        </Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {types.map((t) => (
            <SelectCard
              key={t.value}
              selected={type === t.value}
              onSelect={() => setType(t.value)}
            >
              <div className="flex items-start gap-3">
                <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <t.icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-muted-foreground text-xs">{t.desc}</p>
                </div>
              </div>
            </SelectCard>
          ))}
        </div>
      </div>

      <StepNav slug="property-type" onContinue={validate} />
    </WizardShell>
  )
}
