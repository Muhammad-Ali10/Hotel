"use client"

import * as React from "react"
import { Landmark } from "lucide-react"
import { toast } from "sonner"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useSession } from "@/lib/api/hooks"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { StepNav } from "../_components/step-nav"
import { SelectCard } from "../_components/select-card"
import { useWizard } from "../_components/wizard-provider"

/* ============================================================================
 * Step 22 — who the invoice is addressed to.
 *
 * The answers on this screen used to go three different kinds of nowhere:
 *
 *   · The company name was local state, saved by nothing — and the draft has an
 *     `invoiceName` field for exactly it, which approval uses as the
 *     ORGANISATION'S legal name. A partner typed their registered company and
 *     the company was created named after their hotel.
 *   · The whole invoice address block was five UNCONTROLLED inputs. No value,
 *     no handler, no state: typing into them changed nothing anywhere, and the
 *     country select underneath was fixed to Pakistan.
 *   · Even had they been controlled, `partner_orgs` had no address column to
 *     put them in. It has one now, and approval carries it.
 *
 * The name is stored for every choice, not only "company" — otherwise the
 * organisation is named after the property whatever the partner picked.
 * ========================================================================== */

export default function InvoicingPage() {
  const { data, save } = useWizard()
  const session = useSession()

  const [nameType, setNameType] = React.useState(data.invoiceNameType)
  const [sameAddress, setSameAddress] = React.useState(data.invoiceAddressSame)
  const [company, setCompany] = React.useState(
    data.invoiceNameType === "company" ? data.invoiceName : ""
  )
  const [address, setAddress] = React.useState(data.invoiceAddress)

  /* The account holder's name, from the session — the wizard no longer keeps a
     copy of it, because `/auth/me` is where it actually lives. */
  const personalName =
    [session.data?.firstName, session.data?.lastName].filter(Boolean).join(" ") ||
    "Your name"

  const options: { value: typeof nameType; label: string; sub: string }[] = [
    { value: "personal", label: "Personal name", sub: personalName },
    { value: "property", label: "Property name", sub: data.propertyName || "Your property" },
    { value: "company", label: "Legal company name", sub: "Your registered company name" },
  ]

  /** What the organisation will actually be called. */
  function resolvedName() {
    if (nameType === "company") return company.trim()
    if (nameType === "personal") return personalName
    return data.propertyName
  }

  async function validate() {
    if (nameType === "company" && !company.trim()) {
      toast.error("Enter your registered company name")
      return false
    }
    if (!sameAddress && !address.trim()) {
      toast.error("Enter the address invoices should be sent to")
      return false
    }

    return save({
      invoiceNameType: nameType,
      invoiceName: resolvedName(),
      invoiceAddressSame: sameAddress,
      // Cleared rather than kept when they switch back to "same address", so a
      // stale address cannot resurface on an invoice months later.
      invoiceAddress: sameAddress ? "" : address.trim(),
    })
  }

  return (
    <WizardShell>
      <StepHeading
        title="Invoicing"
        description="What appears on the commission invoice the platform sends you."
      />

      <div className="bg-muted/50 mb-6 flex items-start gap-2 rounded-lg border p-3 text-sm">
        <Landmark className="mt-0.5 size-4 shrink-0" />
        {/* It said "Monthly payouts by bank transfer", which conflated two
            different schedules: payouts run on the 1st and the 16th (rule #48),
            invoices monthly on the 1st (rule #94). */}
        <span>
          Invoices are issued monthly, on the 1st, for the month before. Payouts
          are separate — those run on the 1st and the 16th.
        </span>
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
        <p className="text-muted-foreground text-xs">
          This is also the name your organisation is created under, so it is
          what appears on your partner agreement.
        </p>
      </div>

      <div className="mt-6 space-y-2">
        <Label>Do invoices go to the same address as the property?</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectCard selected={sameAddress} onSelect={() => setSameAddress(true)}>
            <p className="text-sm font-medium">Yes</p>
            <p className="text-muted-foreground text-xs">
              {[data.street, data.city, data.country].filter(Boolean).join(", ") ||
                "Your property address"}
            </p>
          </SelectCard>
          <SelectCard selected={!sameAddress} onSelect={() => setSameAddress(false)}>
            <p className="text-sm font-medium">No, a different address</p>
            <p className="text-muted-foreground text-xs">
              An accountant, a head office, a registered address
            </p>
          </SelectCard>
        </div>
      </div>

      {!sameAddress && (
        <div className="mt-6 space-y-2 rounded-xl border p-4">
          <Label htmlFor="invoice-address">
            Invoice address <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="invoice-address"
            rows={3}
            placeholder={"Finance department\n14 Rue de la Paix\n75002 Paris, France"}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <p className="text-muted-foreground text-xs">
            Written as it should appear on the invoice, including the country.
          </p>
        </div>
      )}

      <StepNav slug="invoicing" onContinue={validate} />
    </WizardShell>
  )
}
