"use client"

import * as React from "react"
import { BedDouble } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { WizardShell, StepHeading } from "../../_components/wizard-shell"
import { TipPanel } from "../../_components/tip-panel"
import { StepNav } from "../../_components/step-nav"
import { useWizard } from "../../_components/wizard-provider"

export default function RoomNamePage() {
  const { data, update } = useWizard()
  const [name, setName] = React.useState(data.draftUnit.name)

  const unit = data.draftUnit
  const beds = unit.beds.twin + unit.beds.full + unit.beds.queen + unit.beds.king
  const meta = [
    `${unit.guests} guests`,
    `${beds} bed${beds === 1 ? "" : "s"}`,
    unit.size ? `${unit.size} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  function validate() {
    if (!name.trim()) {
      toast.error("Please name this room")
      return false
    }
    update({ draftUnit: { ...data.draftUnit, name: name.trim() } })
    return true
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Why standardized names help">
          Standardized names make your rooms easier to find in search results and
          help guests compare similar options. They reduce confusion and booking
          errors. You can customize the description and photos to differentiate
          your space — the name just helps with discoverability.
        </TipPanel>
      }
    >
      <StepHeading
        title="What's the name of this room?"
        description="This name is shown to guests when they browse and book. Pick a clear, recognizable name."
      />

      <div className="space-y-2">
        <Label htmlFor="roomName">
          Room name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="roomName"
          placeholder="Deluxe Double Room"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          Standardized names help guests compare similar rooms across properties.
        </p>
      </div>

      <div className="mt-6">
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Name preview
        </p>
        <div className="flex items-center gap-3 rounded-xl border p-4">
          <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
            <BedDouble className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">{name || "Deluxe Double Room"}</p>
            <p className="text-muted-foreground text-xs">{meta}</p>
          </div>
        </div>
      </div>

      <StepNav slug="unit-name" onContinue={validate} />
    </WizardShell>
  )
}
