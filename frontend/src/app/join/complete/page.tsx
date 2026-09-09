"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Check, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useSession, useSubmitRegistration } from "@/lib/api/hooks"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { SelectCard } from "../_components/select-card"
import { useWizard } from "../_components/wizard-provider"
import { href, prevStep } from "../_lib/steps"

/* ============================================================================
 * Step 31 — the last screen, and the one that finally submits.
 *
 * It never did. The button said "Complete registration and open for bookings",
 * wrote four fields into a browser store, and routed to a page that said the
 * application was with the platform. Nothing had been sent anywhere: no
 * property existed, no reviewer had anything in their queue, and the partner
 * was waiting for a decision on an application that did not exist.
 *
 * Gone with the rewrite:
 *   · Two blocks of "contracting party" details — name, middle name, email,
 *     phone, residence, address lines, city, postcode — every one an
 *     UNCONTROLLED input with a `defaultValue` and no handler. They could not
 *     be edited into anything, and nothing read them if they had been. What
 *     they asked for is already known: the account's name and email, and the
 *     address given at step 6.
 *   · "Sync availability across channels to eliminate double bookings". There
 *     is no channel manager in this product. Promising a partner that their
 *     other listings will stay in sync is the one false claim on this screen
 *     that could cost them a room.
 *   · The button's own promise. Submitting opens a REVIEW, not the property.
 * ========================================================================== */

const perks = [
  "One calendar, rates and availability for every room",
  "Your listing in front of everyone searching your city",
  "Guest messages, bookings and statements in one place",
]

export default function CompleteRegistrationPage() {
  const router = useRouter()
  const { data, view, save, saving } = useWizard()
  const session = useSession()
  const submit = useSubmitRegistration()

  const [contractType, setContractType] = React.useState<"individual" | "business" | null>(
    data.contractType
  )
  const [hostType, setHostType] = React.useState<"private" | "professional" | null>(
    data.hostType
  )
  const [certified, setCertified] = React.useState(data.agreedToTerms)
  const [agreed, setAgreed] = React.useState(data.agreedToTerms)

  /*
   * What the server says is still missing — including the things the draft
   * cannot know about, like an unconfirmed email or a listing with no photos.
   * Shown before the button is pressed, so the last screen is not the first
   * place a partner learns there is more to do.
   */
  const gaps = (view?.gaps ?? []).filter(
    (gap) => gap !== "Accept the partner agreement"
  )
  const contractingParty = [session.data?.firstName, session.data?.lastName]
    .filter(Boolean)
    .join(" ")

  async function complete() {
    if (!hostType) {
      toast.error("Tell us whether you're a private or professional host")
      return
    }
    if (!certified || !agreed) {
      toast.error("Please accept both agreements to continue")
      return
    }

    // Saved first, so `agreedToTerms` is on the draft the server checks a
    // moment later — submit refuses without it, and would refuse its own
    // button press.
    const saved = await save({ contractType, hostType, agreedToTerms: true })
    if (!saved) return

    try {
      await submit.mutateAsync()
      router.push(href("done"))
    } catch (error) {
      /*
       * The API answers with every gap at once, not the first. Listed rather
       * than summarised: "this registration is not finished" tells a partner
       * nothing about which of thirty-one screens to go back to.
       */
      const remaining =
        error && typeof error === "object" && "gaps" in error
          ? (error as { gaps?: string[] }).gaps
          : undefined

      toast.error("Not quite ready to send", {
        description: remaining?.length
          ? remaining.join(" · ")
          : error instanceof Error
            ? error.message
            : "Please try again.",
      })
    }
  }

  function notReady() {
    const prev = prevStep("complete")
    if (prev) router.push(href(prev.path))
  }

  const busy = saving || submit.isPending

  return (
    <WizardShell>
      <StepHeading
        title="Complete registration"
        description="Are you listing the property as a business or an individual? This determines how your partner agreement is drawn up, so it should match your legal status."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectCard
          selected={contractType === "individual"}
          onSelect={() => setContractType("individual")}
          showCheck
        >
          <p className="text-sm font-medium">Individual</p>
          <p className="text-muted-foreground text-xs">
            You are registered as a sole proprietor or individual operating the
            property under your own name.
          </p>
        </SelectCard>
        <SelectCard
          selected={contractType === "business"}
          onSelect={() => setContractType("business")}
          showCheck
        >
          <p className="text-sm font-medium">Business</p>
          <p className="text-muted-foreground text-xs">
            You are contracted through a registered company or legal business
            entity.
          </p>
        </SelectCard>
      </div>

      {contractType && (
        <div className="mt-8 space-y-8">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">The contracting party</h3>
            {/* Shown, not asked. Every one of these is already on file, and a
                second copy typed here would be a second thing to keep true. */}
            <dl className="divide-y rounded-xl border text-sm">
              <Row label="Name" value={contractingParty || "—"} />
              <Row label="Email" value={session.data?.email ?? "—"} />
              <Row
                label={contractType === "business" ? "Company" : "Invoiced as"}
                value={data.invoiceName || data.propertyName || "—"}
              />
              <Row
                label="Address"
                value={
                  data.invoiceAddressSame
                    ? [data.street, data.city, data.country].filter(Boolean).join(", ") || "—"
                    : data.invoiceAddress || "—"
                }
              />
            </dl>
            <p className="text-muted-foreground text-xs">
              Not right? Your name and email live in{" "}
              <Link href="/dashboard/profile" className="text-foreground underline">
                your profile
              </Link>
              ; the rest is on the earlier steps.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Are you a professional or private host?</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectCard selected={hostType === "private"} onSelect={() => setHostType("private")}>
                <p className="text-sm font-medium">Private host</p>
                <p className="text-muted-foreground text-xs">
                  You occasionally rent out your property — you&apos;re not a
                  professional hospitality operator.
                </p>
              </SelectCard>
              <SelectCard
                selected={hostType === "professional"}
                onSelect={() => setHostType("professional")}
              >
                <p className="text-sm font-medium">Professional host</p>
                <p className="text-muted-foreground text-xs">
                  You operate the property as part of a registered hospitality
                  business or manage multiple properties.
                </p>
              </SelectCard>
            </div>
          </section>

          {gaps.length > 0 && (
            <section className="border-destructive/40 bg-destructive/5 rounded-xl border p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="text-destructive size-4" />
                Still to do before this can be sent
              </p>
              <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                {gaps.map((gap) => (
                  <li key={gap}>· {gap}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="bg-muted/40 rounded-xl border p-4">
            <p className="text-sm font-semibold">What you get once you&apos;re approved</p>
            <ul className="mt-3 space-y-2">
              {perks.map((perk) => (
                <li key={perk} className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Check className="size-4 shrink-0 text-green-600 dark:text-green-400" />
                  {perk}
                </li>
              ))}
            </ul>
          </section>

          <div className="space-y-3">
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={certified}
                onCheckedChange={(v) => setCertified(!!v)}
              />
              <span className="text-muted-foreground">
                I certify that I operate a legitimate business and hold all
                required licenses, permits, and registrations to offer
                accommodation at this property.
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(!!v)}
              />
              <span className="text-muted-foreground">
                I have read and agree to the{" "}
                <Link href="/terms" className="text-foreground underline">
                  Terms &amp; Conditions
                </Link>
                ,{" "}
                <Link href="/privacy" className="text-foreground underline">
                  Privacy Policy
                </Link>
                , and the partner agreement, which is added to your account when
                the application is approved.
              </span>
            </label>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Button variant="outline" type="button" onClick={notReady} disabled={busy}>
          I&apos;m not ready
        </Button>
        <Button
          type="button"
          onClick={complete}
          disabled={!contractType || busy}
          className="flex-1"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {/* It said "and open for bookings". Submitting opens a review. */}
          Send my application for review
        </Button>
      </div>
    </WizardShell>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate text-right font-medium">{value}</dd>
    </div>
  )
}
