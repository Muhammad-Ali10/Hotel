"use client"

import * as React from "react"
import { Check, CreditCard, Globe } from "lucide-react"
import { toast } from "sonner"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { StepNav } from "../_components/step-nav"
import { SelectCard } from "../_components/select-card"
import { useWizard } from "../_components/wizard-provider"

const platformSteps = [
  {
    title: "Guest pays via the platform",
    desc: "Guest pays securely online using card, wallet, or bank transfer at booking time.",
  },
  { title: "Platform facilitates the payment", desc: "Funds are held securely until after check-in." },
  { title: "Platform sends monthly payouts", desc: "You receive consolidated payouts to your bank." },
]

const perks = [
  "Fewer cancellations — guests are more committed",
  "Fraud and chargeback protection included",
  "Multiple payment options for guests (cards, wallets, bank transfer)",
]

export default function PaymentsPage() {
  const { data, update } = useWizard()
  const [method, setMethod] = React.useState(data.paymentMethod)

  function validate() {
    if (!method) {
      toast.error("Please choose how guests pay")
      return false
    }
    update({ paymentMethod: method })
    return true
  }

  return (
    <WizardShell>
      <StepHeading
        title="Payments"
        description="How can your guests pay for their stay?"
      />

      <div className="space-y-3">
        <SelectCard
          selected={method === "platform"}
          onSelect={() => setMethod("platform")}
          showCheck
        >
          <div className="flex items-start gap-3">
            <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Globe className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">Online, when they make a reservation</p>
              <p className="text-muted-foreground text-xs">
                The platform facilitates payments securely. Guests pay online and
                you receive payouts.
              </p>
            </div>
          </div>
        </SelectCard>

        <SelectCard
          selected={method === "property"}
          onSelect={() => setMethod("property")}
          showCheck
        >
          <div className="flex items-start gap-3">
            <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
              <CreditCard className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">By credit card at my property</p>
              <p className="text-muted-foreground text-xs">
                You handle payments directly when guests arrive or depart.
              </p>
            </div>
          </div>
        </SelectCard>
      </div>

      {method === "platform" && (
        <>
          <div className="mt-6 rounded-xl border p-4">
            <p className="mb-3 text-sm font-semibold">How platform payments work</p>
            <ol className="space-y-3">
              {platformSteps.map((step, i) => (
                <li key={step.title} className="flex gap-3">
                  <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-muted-foreground text-xs">{step.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <ul className="mt-4 space-y-2">
            {perks.map((perk) => (
              <li key={perk} className="text-muted-foreground flex items-center gap-2 text-sm">
                <Check className="size-4 shrink-0 text-green-600 dark:text-green-400" />
                {perk}
              </li>
            ))}
          </ul>
        </>
      )}

      <StepNav slug="payments" onContinue={validate} />
    </WizardShell>
  )
}
