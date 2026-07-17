"use client"

import * as React from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"

type Owner = { id: string; first: string; last: string; month: string; day: string; year: string }

const ownerTypes = [
  { value: "individual", label: "I'm an individual running a business" },
  { value: "business", label: "I represent a business entity" },
]

function newOwner(i: number): Owner {
  return { id: `owner-${i}`, first: "", last: "", month: "", day: "", year: "" }
}

export default function VerificationPage() {
  const { data, update } = useWizard()
  const [ownerType, setOwnerType] = React.useState<"individual" | "business">(data.ownerType)
  const [owners, setOwners] = React.useState<Owner[]>([newOwner(1)])
  const [aliases, setAliases] = React.useState("")

  const editOwner = (id: string, patch: Partial<Owner>) =>
    setOwners((os) => os.map((o) => (o.id === id ? { ...o, ...patch } : o)))

  function validate() {
    if (owners.some((o) => !o.first.trim() || !o.last.trim())) {
      toast.error("Please provide every owner's full name")
      return false
    }
    update({ ownerType })
    return true
  }

  return (
    <WizardShell>
      <StepHeading
        title="Partner verification"
        description="To comply with legal and regulatory requirements, we need to verify the ownership structure of your accommodation. This information is kept secure and confidential."
      />

      <div className="space-y-2">
        <Label>
          Is the accommodation owned by an individual or business entity?{" "}
          <span className="text-destructive">*</span>
        </Label>
        <Select
          items={ownerTypes}
          value={ownerType}
          onValueChange={(v) => setOwnerType(v as "individual" | "business")}
        >
          <SelectTrigger className="w-full" size="default">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ownerTypes.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ownerType === "business" && (
        <div className="mt-6 space-y-4 rounded-xl border p-4">
          <p className="text-sm font-semibold">Business entity details</p>
          <div className="space-y-2">
            <Label htmlFor="biz-name">
              Full name of business entity <span className="text-destructive">*</span>
            </Label>
            <Input id="biz-name" placeholder="e.g. Alpine Hospitality Pvt Ltd" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="biz-address">
              Address of business entity <span className="text-destructive">*</span>
            </Label>
            <Input id="biz-address" placeholder="Street address" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="biz-zip">
                Zip Code <span className="text-destructive">*</span>
              </Label>
              <Input id="biz-zip" placeholder="Zip / Postal code" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="biz-city">
                City <span className="text-destructive">*</span>
              </Label>
              <Input id="biz-city" placeholder="City" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="biz-trading">Trading as (optional)</Label>
            <Input id="biz-trading" placeholder="If different from legal business name" />
          </div>
        </div>
      )}

      <div className="mt-6">
        <p className="text-muted-foreground mb-3 text-sm">
          Provide the full names and dates of birth of all individuals who own
          25% or more of the accommodation
        </p>
        <div className="space-y-4">
          {owners.map((owner, i) => (
            <div key={owner.id} className="space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Owner {i + 1}</p>
                {owners.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setOwners((os) => os.filter((o) => o.id !== owner.id))}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Remove owner"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    First name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="First name"
                    value={owner.first}
                    onChange={(e) => editOwner(owner.id, { first: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Last name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Last name"
                    value={owner.last}
                    onChange={(e) => editOwner(owner.id, { last: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Date of birth <span className="text-destructive">*</span>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Month"
                    placeholder="mm"
                    inputMode="numeric"
                    maxLength={2}
                    value={owner.month}
                    onChange={(e) => editOwner(owner.id, { month: e.target.value })}
                    className="w-16 text-center"
                  />
                  <span className="text-muted-foreground">/</span>
                  <Input
                    aria-label="Day"
                    placeholder="dd"
                    inputMode="numeric"
                    maxLength={2}
                    value={owner.day}
                    onChange={(e) => editOwner(owner.id, { day: e.target.value })}
                    className="w-16 text-center"
                  />
                  <span className="text-muted-foreground">/</span>
                  <Input
                    aria-label="Year"
                    placeholder="yyyy"
                    inputMode="numeric"
                    maxLength={4}
                    value={owner.year}
                    onChange={(e) => editOwner(owner.id, { year: e.target.value })}
                    className="w-20 text-center"
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOwners((os) => [...os, newOwner(os.length + 1)])}
            className="hover:bg-muted/40 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-2.5 text-sm font-medium transition-colors"
          >
            <Plus className="size-4" />
            Add another owner
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <Label htmlFor="aliases">
          If any owners go by alternative name(s), please list them here (optional)
        </Label>
        <Textarea
          id="aliases"
          placeholder="e.g. Robert Smith also known as Bob Smith"
          value={aliases}
          onChange={(e) => setAliases(e.target.value)}
        />
      </div>

      <StepNav slug="verification" onContinue={validate} />
    </WizardShell>
  )
}
