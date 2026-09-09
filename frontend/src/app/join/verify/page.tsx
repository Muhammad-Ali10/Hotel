"use client"

import Link from "next/link"
import { CheckCircle2, Loader2, MailCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { useResendVerification, useSession } from "@/lib/api/hooks"

import { WizardShell } from "../_components/wizard-shell"
import { StepNav } from "../_components/step-nav"

/**
 * The verification screen, after the account exists.
 *
 * It used to say so itself: "No real email is sent — this is a demo
 * verification", above a button that set a boolean nothing read. Now signup
 * sends a `verify_email` notification, the link in it lands on
 * `/verify-email?token=…`, and this screen shows where that stands.
 *
 * Verification is NOT a wall here. The link is read in a mail client, often on
 * a different device, and holding the wizard shut until then would strand an
 * applicant who wants to keep going on the laptop in front of them. It is
 * enforced where it matters — at submit, because the partner agreement, the
 * payout account and the approval decision all hang off this address being
 * real.
 */
export default function VerifyAccountPage() {
  const session = useSession()
  const resend = useResendVerification()

  const email = session.data?.email ?? ""
  const verified = session.data?.emailVerified ?? false

  async function sendAgain() {
    try {
      await resend.mutateAsync()
      toast.success("Link sent", { description: `Check ${email} — it can take a minute.` })
    } catch (error) {
      toast.error("Couldn't send the link", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }

  return (
    <WizardShell>
      <Card>
        <CardContent className="flex flex-col items-center px-6 py-10 text-center">
          <span className="bg-muted flex size-14 items-center justify-center rounded-full">
            {verified ? (
              <CheckCircle2 className="size-7 text-green-600 dark:text-green-400" />
            ) : (
              <MailCheck className="size-7" />
            )}
          </span>

          <h1 className="font-heading mt-5 text-2xl font-semibold tracking-tight">
            {verified ? "Email confirmed" : "Confirm your email"}
          </h1>

          {verified ? (
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              <span className="text-foreground font-medium">{email}</span> is
              verified. Let&apos;s get to the property.
            </p>
          ) : (
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              We&apos;ve sent a link to{" "}
              <span className="text-foreground font-medium">{email}</span>. Open
              it whenever suits — you can carry on with your property now, and
              we&apos;ll ask for it again before your application goes in.
            </p>
          )}

          {!verified && (
            <Button
              variant="outline"
              className="mt-6 w-full max-w-xs"
              onClick={sendAgain}
              disabled={resend.isPending}
            >
              {resend.isPending && <Loader2 className="size-4 animate-spin" />}
              Send the link again
            </Button>
          )}

          <StepNav
            slug="verify"
            hideBack
            nextLabel="Continue to your property"
            className="w-full max-w-xs"
          />

          <p className="text-muted-foreground mt-4 text-xs">
            Need help?{" "}
            <Link href="/support" className="text-foreground hover:underline">
              Contact Partner Support
            </Link>
          </p>
        </CardContent>
      </Card>
    </WizardShell>
  )
}
