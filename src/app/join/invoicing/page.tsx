"use client"

import * as React from "react"
import { Landmark } from "lucide-react"

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
import { StepNav } from "../_components/step-nav"
import { SelectCard } from "../_components/select-card"
import { useWizard } from "../_components/wizard-provider"

const countries = ["Pakistan", "United Arab Emirates", "Saudi Arabia", "United Kingdom"].map(
  (v) => ({ value: v, label: v }),
)

export default function InvoicingPage() {
  const { data, update } = useWizard()
  const [nameType, setNameType] = React.useState(data.invoiceNameType)
  const [sameAddress, setSameAddress] = React.useState(data.invoiceAddressSame)
  const [company, setCompany] = React.useState("")

  const personalName = [data.firstName, data.lastName].filter(Boolean).join(" ") || "Your name"

  const options: { value: typeof nameType; label: string; sub: string }[] = [
    { value: "personal", label: "Personal name", sub: personalName },
    { value: "property", label: "Property name", sub: data.propertyName || "Your property" },
    { value: "company", label: "Legal company name", sub: "Specify your registered company name" },
  ]

  return (
    <WizardShell>
      <StepHeading
        title="Invoicing"
        description="Set up how you receive your monthly payouts and what appears on invoices."
      />

      <div className="bg-muted/50 mb-6 flex items-center gap-2 rounded-lg border p-3 text-sm">
        <Landmark className="size-4 shrink-0" />
        Monthly payouts by bank transfer
      </div>

      <div className="space-y-2">
        <Label>
          What name should be on the invoice? <span className="text-destructive">*</span>
        </Label>
        <div className="space-y-2">
          {options.map((opt) => (
            <SelectCard
              key={opt.value}
              selected={nameType === opt.value}
              onSelect={() => setNameType(opt.value)}
            >
              <p className="text-sm font-medium">{opt.label}</p>
              <p className="text-muted-foreground text-xs">{opt.sub}</p>
              {opt.value === "company" && nameType === "company" && (
                <Input
                  placeholder="Registered company name"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2"
                />
              )}
            </SelectCard>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-2">
        <Label>Does this recipient have the same address as your property?</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectCard selected={sameAddress} onSelect={() => setSameAddress(true)}>
            <p className="text-sm font-medium">Yes</p>
          </SelectCard>
          <SelectCard selected={!sameAddress} onSelect={() => setSameAddress(false)}>
            <p className="text-sm font-medium">No, different address</p>
          </SelectCard>
        </div>
      </div>

      {!sameAddress && (
        <div className="mt-6 space-y-4 rounded-xl border p-4">
          <p className="text-sm font-semibold">Invoice address</p>
          <div className="space-y-2">
            <Label htmlFor="inv-street">Street address</Label>
            <Input id="inv-street" placeholder="Street address" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inv-city">City</Label>
              <Input id="inv-city" placeholder="City" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-state">State/Province</Label>
              <Input id="inv-state" placeholder="State/Province" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-zip">ZIP/Postal code</Label>
              <Input id="inv-zip" placeholder="ZIP/Postal code" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-country">Country</Label>
              <Select items={countries} defaultValue="Pakistan">
                <SelectTrigger id="inv-country" className="w-full" size="default">
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
        </div>
      )}

      <StepNav
        slug="invoicing"
        onContinue={() =>
          update({ invoiceNameType: nameType, invoiceAddressSame: sameAddress })
        }
      />
    </WizardShell>
  )
}
