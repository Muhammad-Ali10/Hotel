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

// USD first — it's the platform settlement currency every other surface quotes.
const currencies = ["USD", "EUR", "GBP", "AED"].map((v) => ({ value: v, label: v }))

export default function PayoutPage() {
  const { data, view, save } = useWizard()
  const [form, setForm] = React.useState({
    payoutCurrency: data.payoutCurrency,
    accountHolder: data.accountHolder,
    bankName: data.bankName,
    iban: data.iban,
    swift: data.swift,
  })
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }))

  /* Basis points, so a negotiated 12.5% reads as exactly that. Quoted from the
     applicant's own draft rather than from a number typed into this copy. */
  const rateBps = view?.commissionRateBps ?? null

  async function validate() {
    /*
     * The holder and the account number — the two `submissionGaps` asks for.
     * The bank name was required here and is not required at submit; it is
     * useful for recognising the account, not for reaching it.
     */
    if (!form.accountHolder.trim() || !form.iban.trim()) {
      toast.error("The account holder's name and the account number are needed")
      return false
    }
    return save({
      payoutCurrency: form.payoutCurrency,
      accountHolder: form.accountHolder.trim(),
      bankName: form.bankName.trim(),
      iban: form.iban.trim(),
      swift: form.swift.trim(),
    })
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="About payouts">
          {/* The real cycle (rules #48 and #50), not "7 days after checkout" —
              which is not how this platform pays anybody. And the commission is
              read from the application, not asserted as "typically 15%". */}
          Payouts run twice a month, on the 1st and the 16th, covering stays
          that have completed. Anything under $100 carries to the next cycle
          rather than being sent — nothing is lost, it just waits until it is
          worth the transfer fee.
          {rateBps === null
            ? " Commission is deducted before the transfer."
            : ` Commission of ${(rateBps / 100).toFixed(2)}% is deducted before the transfer.`}{" "}
          Every cycle comes with a statement in the extranet.
        </TipPanel>
      }
    >
      <StepHeading
        title="Payout details"
        description="Where your earnings are sent. Money only leaves to an account the platform has verified, so this is checked before your first payout."
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
            Bank name
          </Label>
          {/* Typed, not picked. It was a list of seven international banks with
              an "Other" escape hatch — on a marketplace whose partners bank
              wherever their property is, most of them had to choose "Other". */}
          <Input
            id="bank"
            placeholder="e.g. Emirates NBD"
            value={form.bankName}
            onChange={(e) => set("bankName")(e.target.value)}
          />
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

        {/* Something a partner can check, instead of "your information is
            secure" — which every form says and none of them explain. */}
        <div className="bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-lg border p-3 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          <span>
            Once your application is approved, only the last four digits of this
            account number are kept. The full number is not stored.
          </span>
        </div>
      </div>

      <StepNav slug="payout" nextLabel="Complete registration" onContinue={validate} />
    </WizardShell>
  )
}
