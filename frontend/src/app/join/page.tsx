"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { useWizard } from "./_components/wizard-provider"
import { WizardShell, StepHeading } from "./_components/wizard-shell"
import { TipPanel } from "./_components/tip-panel"
import { useAccountDraft } from "./_lib/account-store"
import { href, nextStep, resumeHref } from "./_lib/steps"

export default function CreateAccountPage() {
  const router = useRouter()
  const { data, update } = useAccountDraft()
  const { view } = useWizard()
  const [email, setEmail] = React.useState(data.email)

  /*
   * Somebody already signed in does not need to create an account again.
   *
   * Their application is on the server, so they go back to the step they left
   * rather than to an empty email field — which, before this, is what a
   * partner returning the next morning was shown.
   */
  React.useEffect(() => {
    if (!view) return
    router.replace(view.status === "in_progress" ? resumeHref(view.currentStep) : "/join/done")
  }, [view, router])

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    update({ email: email.trim() })
    const next = nextStep("create-account")
    if (next) router.push(href(next.path))
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Why create a partner account?">
          A partner account gives you access to the Extranet — your central hub
          for managing rates, availability, bookings, guest messages, and
          financial reports. It&apos;s free to create and takes about 5 minutes
          to set up your first property.
        </TipPanel>
      }
    >
      <Card>
        <CardContent className="pt-6">
          <StepHeading
            title="Create your partner account"
            description="Create an account to list and manage your property."
          />
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={!email.trim()}>
              Continue
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="bg-border h-px flex-1" />
            <span className="text-muted-foreground text-xs">OR</span>
            <span className="bg-border h-px flex-1" />
          </div>

          <p className="text-muted-foreground text-center text-sm">
            Do you have questions about your property or the Extranet?{" "}
            <Link href="/support" className="text-foreground font-medium hover:underline">
              Visit Partner Help.
            </Link>
          </p>

          <Button
            variant="outline"
            className="mt-4 w-full"
            render={<Link href="/login">Sign in</Link>}
          />

          <div className="text-muted-foreground mt-6 flex items-center justify-center gap-2 text-xs">
            <Link href="#" className="hover:text-foreground">
              Terms of Service
            </Link>
            <span>·</span>
            <Link href="#" className="hover:text-foreground">
              Privacy Policy
            </Link>
            <span>·</span>
            <span>© 2026 Stayora</span>
          </div>
        </CardContent>
      </Card>
    </WizardShell>
  )
}
