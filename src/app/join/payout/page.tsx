"use client"

import * as React from "react"
import { ShieldCheck } from "lucide-react"
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

const currencies = ["PKR", "USD", "EUR", "GBP", "AED"].map((v) => ({ value: v, label: v }))
const banks = [
  "Standard Chartered",
  "HBL",
  "Meezan Bank",
  "UBL",
  "MCB Bank",
  "Allied Bank",
  "Bank Alfalah",
].map((v) => ({ value: v, label: v }))

export default function PayoutPage() {
  const { data, update } = useWizard()
  const [form, setForm] = React.useState({
    payoutCurrency: data.payoutCurrency,
    accountHolder: data.accountHolder,
    bankName: data.bankName,
    iban: data.iban,
    swift: data.swift,
  })
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  function validate() {
    if (!form.accountHolder.trim() || !form.bankName || !form.iban.trim()) {
      toast.error("Please complete the required payout fields")
      return false
    }
    update(form)
    return true
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="About payouts">
          Payouts are processed 7 days after guest checkout, once the stay is
          confirmed complete. The first payout may take up to 14 days for account
          verification. Commission (typically 15%) is deducted automatically.
          You&apos;ll receive detailed payout statements in the Extranet finance
          section.
        </TipPanel>
      }
    >
      <StepHeading
        title="Payout details"
        description="Tell us where to send your earnings. All payouts are processed within 7 business days after guest checkout."
      />

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="currency">Payout currency</Label>
          <Select
            items={currencies}
            value={form.payoutCurrency}
            onValueChange={(v) => set("payoutCurrency")(v as string)}
          >
            <SelectTrigger id="currency" className="w-full" size="default">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Payouts are sent in this currency. Conversion fees may apply for
            non-local currencies.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="holder">
            Account holder name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="holder"
            placeholder="e.g. Ahmed Khan"
            value={form.accountHolder}
            onChange={(e) => set("accountHolder")(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Name must match your bank account exactly.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="bank">
            Bank name <span className="text-destructive">*</span>
          </Label>
          <Select
            items={banks}
            value={form.bankName}
            onValueChange={(v) => set("bankName")(v as string)}
          >
            <SelectTrigger id="bank" className="w-full" size="default">
              <SelectValue placeholder="Select your bank" />
            </SelectTrigger>
            <SelectContent>
              {banks.map((b) => (
                <SelectItem key={b.value} value={b.value}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="iban">
            IBAN / Account number <span className="text-destructive">*</span>
          </Label>
          <Input
            id="iban"
            placeholder="e.g. PK36 SCBL 0000 0011 2345 6789"
            value={form.iban}
            onChange={(e) => set("iban")(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            IBAN format preferred. Your payout will be delayed if the account
            number is incorrect.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="swift">SWIFT / BIC code (optional)</Label>
          <Input
            id="swift"
            placeholder="e.g. SCBLPKKX"
            value={form.swift}
            onChange={(e) => set("swift")(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Required only for international bank transfers.
          </p>
        </div>

        <div className="bg-muted/50 text-muted-foreground flex items-center gap-2 rounded-lg border p-3 text-sm">
          <ShieldCheck className="size-4 shrink-0" />
          Your information is secure
        </div>
      </div>

      <StepNav slug="payout" nextLabel="Complete registration" onContinue={validate} />
    </WizardShell>
  )
}
