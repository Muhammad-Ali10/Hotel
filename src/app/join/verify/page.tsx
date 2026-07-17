"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { MailCheck } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { WizardShell } from "../_components/wizard-shell"
import { useWizard } from "../_components/wizard-provider"
import { href, nextStep } from "../_lib/steps"

export default function VerifyAccountPage() {
  const router = useRouter()
  const { data, update } = useWizard()
  const email = data.email || "you@example.com"

  function verify() {
    update({ verified: true })
    toast.success("Email verified")
    const next = nextStep("verify")
    if (next) router.push(href(next.path))
  }

  return (
    <WizardShell>
      <Card>
        <CardContent className="flex flex-col items-center px-6 py-10 text-center">
          <span className="bg-muted flex size-14 items-center justify-center rounded-full">
            <MailCheck className="size-7" />
          </span>
          <h1 className="font-heading mt-5 text-2xl font-semibold tracking-tight">
            Verify your account
          </h1>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
            Click below to verify your email{" "}
            <span className="text-foreground font-medium">{email}</span>. No real
            email is sent — this is a demo verification for you to continue
            through the wizard.
          </p>
          <Button className="mt-6 w-full max-w-xs" onClick={verify}>
            Verify &amp; Continue
          </Button>
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
