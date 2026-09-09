"use client"

import * as React from "react"
import { Check, CreditCard, Globe } from "lucide-react"
import { toast } from "sonner"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { StepNav } from "../_components/step-nav"
import { SelectCard } from "../_components/select-card"
import { useWizard } from "../_components/wizard-provider"

/*
 * What actually happens, in order.
 *
 * The three steps here described a different product. "Card, wallet, or bank
 * transfer" — the payments table holds a card brand and last four digits and
 * nothing else, so cards are the whole list. "Held until after check-in" — the
 * money is released for stays that have COMPLETED, which is a different moment
 * and usually a later one. "Monthly payouts" — the cycle is the 1st and the
 * 16th (rule #48).
 */
const platformSteps = [
  {
    title: "The guest pays when they book",
    desc: "By card, on the platform. You never see or hold their card details.",
  },
  {
    title: "The platform holds it until the stay is done",
    desc: "Money is released for stays that have completed, not on arrival.",
  },
  {
    title: "You are paid on the 1st and the 16th",
    desc: "One transfer covering everything released since the last cycle, with a statement.",
  },
]

/*
 * "Fraud and chargeback protection included" was a commercial guarantee — that
 * the platform absorbs a disputed charge — and nothing in this system does
 * that. It is not a small thing to promise a partner by accident.
 */
const perks = [
  "You never hold card details, so a chargeback is not yours to answer",
  "Guests who have already paid turn up — no card declined at the desk",
  "Every cycle comes with a statement you can reconcile against",
]

export default function PaymentsPage() {
  const { data, save } = useWizard()
  const [method, setMethod] = React.useState(data.paymentMethod)

  async function validate() {
    if (!method) {
      toast.error("Please choose how guests pay")
      return false
    }
    /*
     * `platform` becomes `prepay` and `property` becomes `guarantee` at
     * approval (rule #42) — translated there rather than stored here, so the
     * wizard's two words never become a third vocabulary for what the booking
     * tables already name.
     */
    return save({ paymentMethod: method })
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
                The platform charges the card at booking and pays you on the
                cycle. This is also the only way a non-refundable rate can be
                sold.
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
                The card is held as a guarantee and you take payment at the
                desk. You then owe the platform its commission, invoiced
                monthly, rather than having it deducted.
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
