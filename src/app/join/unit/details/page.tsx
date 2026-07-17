"use client"

import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { WizardShell, StepHeading } from "../../_components/wizard-shell"
import { TipPanel } from "../../_components/tip-panel"
import { StepNav } from "../../_components/step-nav"
import { Counter } from "../../_components/counter"
import { useWizard } from "../../_components/wizard-provider"
import type { UnitDraft } from "../../_lib/types"

const unitTypes = ["Room", "Apartment", "Studio", "Suite", "Bungalow", "Villa"].map(
  (v) => ({ value: v, label: v }),
)

const bedRows: { key: keyof UnitDraft["beds"]; label: string; width: string }[] = [
  { key: "twin", label: "Twin bed(s)", width: "35–51 in wide" },
  { key: "full", label: "Full bed(s)", width: "52–59 in wide" },
  { key: "queen", label: "Queen bed(s)", width: "60–70 in wide" },
  { key: "king", label: "King bed(s)", width: "71–81 in wide" },
]

export default function RoomDetailsPage() {
  const { data, update } = useWizard()
  const [unit, setUnit] = React.useState<UnitDraft>(data.draftUnit)
  const [excludeInfants, setExcludeInfants] = React.useState(false)

  const patch = (p: Partial<UnitDraft>) => setUnit((u) => ({ ...u, ...p }))
  const setBed = (key: keyof UnitDraft["beds"], value: number) =>
    setUnit((u) => ({ ...u, beds: { ...u.beds, [key]: value } }))

  return (
    <WizardShell
      aside={
        <TipPanel title="Sleeping arrangements">
          Accurate bed details are one of the top factors guests consider when
          booking. Include all sleeping surfaces — sofa beds and cribs can be
          added later. Children under 2 stay free at most properties; check your
          local regulations for child policies.
        </TipPanel>
      }
    >
      <StepHeading
        title="Room Details"
        description="Tell us about the layout and configuration of this space."
      />

      <div className="space-y-5">
        <div className="space-y-2">
          <Label>
            What type of unit is this? <span className="text-destructive">*</span>
          </Label>
          <Select
            items={unitTypes}
            value={unit.unitType}
            onValueChange={(v) => patch({ unitType: v as string })}
          >
            <SelectTrigger className="w-full" size="default">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {unitTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="unitCount">
            How many {unit.unitType}s of this type do you have?{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="unitCount"
            type="number"
            min={1}
            value={unit.unitCount}
            onChange={(e) => patch({ unitCount: Math.max(1, Number(e.target.value) || 1) })}
            className="w-28"
          />
        </div>

        <div className="space-y-3">
          <Label>What beds are available?</Label>
          <div className="divide-y rounded-xl border">
            {bedRows.map((bed) => (
              <div key={bed.key} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{bed.label}</p>
                  <p className="text-muted-foreground text-xs">{bed.width}</p>
                </div>
                <Counter value={unit.beds[bed.key]} onChange={(v) => setBed(bed.key, v)} />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>How many guests can stay?</Label>
          <Counter
            value={unit.guests}
            onChange={(v) => patch({ guests: v })}
            min={1}
            suffix="guests"
          />
          <label className="text-muted-foreground flex items-center gap-2 pt-1 text-sm">
            <Checkbox checked={excludeInfants} onCheckedChange={(v) => setExcludeInfants(!!v)} />
            Exclude infants (0–2 years old) from total number of guests
          </label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="size">How big is this {unit.unitType}?</Label>
          <div className="flex items-stretch gap-2">
            <Input
              id="size"
              type="number"
              placeholder="500"
              value={unit.size}
              onChange={(e) => patch({ size: e.target.value })}
              className="w-32"
            />
            <span className="bg-muted text-muted-foreground flex items-center rounded-lg border px-3 text-sm">
              Square meters
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Is smoking allowed?</Label>
          <div className="flex gap-2">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => patch({ smoking: opt.value })}
                aria-pressed={unit.smoking === opt.value}
                className={
                  "rounded-lg border px-5 py-2 text-sm transition-colors " +
                  (unit.smoking === opt.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted/60")
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <StepNav slug="unit-details" onContinue={() => update({ draftUnit: unit })} />
    </WizardShell>
  )
}
