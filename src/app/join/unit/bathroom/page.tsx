"use client"

import * as React from "react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

import { WizardShell, StepHeading } from "../../_components/wizard-shell"
import { TipPanel } from "../../_components/tip-panel"
import { StepNav } from "../../_components/step-nav"
import { SelectCard } from "../../_components/select-card"
import { useWizard } from "../../_components/wizard-provider"

const items = [
  "Toilet paper",
  "Shower",
  "Toilet",
  "Hairdryer",
  "Bathtub",
  "Free toiletries",
  "Bidet",
  "Slippers",
  "Bathrobe",
  "Spa tub",
]

export default function BathroomDetailsPage() {
  const { data, update } = useWizard()
  const [isPrivate, setIsPrivate] = React.useState<boolean | null>(data.draftUnit.bathroomPrivate)
  const [selected, setSelected] = React.useState<string[]>(data.draftUnit.bathroomItems)

  const toggle = (item: string) =>
    setSelected((s) => (s.includes(item) ? s.filter((x) => x !== item) : [...s, item]))

  function validate() {
    if (isPrivate === null) {
      toast.error("Please tell us if the bathroom is private")
      return false
    }
    update({
      draftUnit: { ...data.draftUnit, bathroomPrivate: isPrivate, bathroomItems: selected },
    })
    return true
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Still deciding?">
          Private bathrooms are expected by 89% of travelers and command higher
          nightly rates. If your property has shared bathrooms, be upfront —
          transparency leads to better reviews. You can add multiple bathrooms
          per unit in the Extranet later.
        </TipPanel>
      }
    >
      <StepHeading
        title="Bathroom details"
        description="Tell guests about the bathroom setup in this room."
      />

      <div className="space-y-6">
        <div>
          <Label className="mb-3 block">Is the bathroom private?</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectCard selected={isPrivate === true} onSelect={() => setIsPrivate(true)}>
              <p className="text-sm font-medium">Yes, it&apos;s private</p>
            </SelectCard>
            <SelectCard selected={isPrivate === false} onSelect={() => setIsPrivate(false)}>
              <p className="text-sm font-medium">No, it&apos;s shared</p>
            </SelectCard>
          </div>
        </div>

        <div>
          <Label className="mb-3 block">What bathroom items are available?</Label>
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => {
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
      </div>

      <StepNav slug="unit-bathroom" onContinue={validate} />
    </WizardShell>
  )
}
