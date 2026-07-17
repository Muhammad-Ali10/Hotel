"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"

function isStrong(pw: string) {
  return pw.length >= 10 && /[a-z]/.test(pw) && /[A-Z]/.test(pw) && /\d/.test(pw)
}

export default function CreatePasswordPage() {
  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")

  function validate() {
    if (!isStrong(password)) {
      toast.error("Password too weak", {
        description:
          "Use at least 10 characters with uppercase, lowercase, and numbers.",
      })
      return false
    }
    if (password !== confirm) {
      toast.error("Passwords don't match")
      return false
    }
    toast.success("Account created")
    return true
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Creating a strong password">
          A strong password uses a mix of character types and is at least 10
          characters long. Avoid using common words, your name, or personal
          information. Consider using a password manager to generate and store
          secure passwords.
        </TipPanel>
      }
    >
      <Card>
        <CardContent className="pt-6">
          <StepHeading
            title="Create password"
            description="Use a minimum of 10 characters, including uppercase letters, lowercase letters, and numbers."
          />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>

          <StepNav slug="password" nextLabel="Create account" onContinue={validate} />

          <p className="text-muted-foreground mt-4 text-center text-xs">
            By creating an account, you agree to our{" "}
            <Link href="#" className="hover:text-foreground underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="#" className="hover:text-foreground underline">
              Privacy Policy
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </WizardShell>
  )
}
