"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"

import { WizardShell, StepHeading } from "../../_components/wizard-shell"
import { TipPanel } from "../../_components/tip-panel"
import { StepNav } from "../../_components/step-nav"
import { useWizard } from "../../_components/wizard-provider"
import type { UnitDraft } from "../../_lib/types"

const groups: { label: string; items: string[] }[] = [
  {
    label: "General amenities",
    items: [
      "Clothes rack",
      "Flat-screen TV",
      "Air conditioning",
      "Linens",
      "Desk",
      "Wake-up service",
      "Towels",
      "Wardrobe or closet",
      "Heating",
      "Fan",
      "Safe",
      "Towels/Sheets (extra fee)",
      "Entire unit located on ground floor",
    ],
  },
  { label: "Outdoors and views", items: ["Balcony", "Terrace", "View"] },
  {
    label: "Food and drink",
    items: ["Electric kettle", "Tea/Coffee maker", "Dining area", "Dining table", "Microwave"],
  },
]

export default function RoomAmenitiesPage() {
  const { data, update } = useWizard()
  const [selected, setSelected] = React.useState<string[]>(data.draftUnit.amenities)

  const toggle = (item: string) =>
    setSelected((s) => (s.includes(item) ? s.filter((x) => x !== item) : [...s, item]))

  function commit() {
    const next: UnitDraft = { ...data.draftUnit, amenities: selected }
    update({ draftUnit: next })
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="More amenities, more visibility">
          Properties with complete amenity lists appear in more filtered
          searches. Guests often filter by specific items like air conditioning,
          WiFi, or kitchen facilities. Every amenity you add increases your
          chances of being found.
        </TipPanel>
      }
    >
      <StepHeading
        title="What can guests use in this room?"
        description="Select everything available to guests. Accurate amenities improve your search ranking."
      />
      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <h3 className="mb-2.5 text-sm font-semibold">{group.label}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.items.map((item) => {
                const checked = selected.includes(item)
                return (
                  <label
                    key={item}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                      checked ? "border-primary bg-primary/[0.03]" : "hover:bg-muted/40",
                    )}
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(item)} />
                    <span>{item}</span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <StepNav slug="unit-amenities" onContinue={commit} />
    </WizardShell>
  )
}
