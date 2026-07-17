"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { SelectCard } from "../_components/select-card"
import { useWizard } from "../_components/wizard-provider"
import { href, nextStep, prevStep } from "../_lib/steps"

const freeOptions = [
  { value: "6pm-arrival", label: "Before 6 pm on the day of arrival" },
  { value: "1-day", label: "1 day before arrival" },
  { value: "3-days", label: "3 days before arrival" },
  { value: "7-days", label: "7 days before arrival" },
  { value: "14-days", label: "14 days before arrival" },
]

export default function CancellationPage() {
  const router = useRouter()
  const { data, update } = useWizard()
  const [freeUntil, setFreeUntil] = React.useState(data.cancelFreeUntil)
  const [charge, setCharge] = React.useState(data.cancelCharge)
  const [accidental, setAccidental] = React.useState(true)

  function save() {
    update({ cancelFreeUntil: freeUntil, cancelCharge: charge })
    const next = nextStep("cancellation")
    if (next) router.push(href(next.path))
  }
  function cancel() {
    const prev = prevStep("cancellation")
    if (prev) router.push(href(prev.path))
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Balancing bookings and protection">
          Flexible policies (free cancellation close to arrival) attract more
          bookings but increase cancellation risk. Strict policies protect your
          revenue but may reduce booking volume. For new properties, a moderate
          policy with accidental booking protection strikes a good balance — you
          get bookings while guests feel safe.
        </TipPanel>
      }
    >
      <StepHeading
        title="Cancellation policies"
        description="Set clear cancellation terms so guests know what to expect."
      />

      <div className="space-y-2">
        <Label>
          When can guests cancel their bookings for free?{" "}
          <span className="text-destructive">*</span>
        </Label>
        <Select
          items={freeOptions}
          value={freeUntil}
          onValueChange={(v) => setFreeUntil(v as string)}
        >
          <SelectTrigger className="w-full" size="default">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {freeOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 space-y-2">
        <Label>
          How much are guests charged if they cancel after the cancellation
          window? <span className="text-destructive">*</span>
        </Label>
        <div className="space-y-2">
          <SelectCard selected={charge === "first-night"} onSelect={() => setCharge("first-night")}>
            <p className="text-sm font-medium">Cost of the first night</p>
            <p className="text-muted-foreground text-xs">
              Guests pay only the first night&apos;s rate when cancelling late.
            </p>
          </SelectCard>
          <SelectCard selected={charge === "full"} onSelect={() => setCharge("full")}>
            <p className="text-sm font-medium">100% of the total price</p>
            <p className="text-muted-foreground text-xs">
              Guests pay the full booking amount if they cancel late.
            </p>
          </SelectCard>
        </div>
      </div>

      <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border p-4">
        <div>
          <p className="text-sm font-medium">Protection against accidental bookings</p>
          <p className="text-muted-foreground text-xs">
            Guests can cancel free of charge within 24 hours of an accidental
            booking.
          </p>
        </div>
        <Switch checked={accidental} onCheckedChange={setAccidental} />
      </div>

      <div className="mt-8 flex items-center gap-3">
        <Button variant="outline" type="button" onClick={cancel}>
          <ArrowLeft className="size-4" />
          Cancel
        </Button>
        <Button type="button" onClick={save} className="flex-1">
          Save and finish
        </Button>
      </div>
    </WizardShell>
  )
}
