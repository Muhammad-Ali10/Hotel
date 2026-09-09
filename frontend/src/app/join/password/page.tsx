"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

import { PASSWORD_MIN, signupSchema } from "@stayora/shared"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authApi } from "@/lib/api/endpoints"
import { useLogin, useUpdateProfile } from "@/lib/api/hooks"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useAccountDraft } from "../_lib/account-store"

/**
 * The screen that actually creates the account.
 *
 * It used to `toast.success("Account created")` and move on — no account, no
 * session, and twenty-seven screens of property details that would be typed
 * into a browser tab and then thrown away, because everything after this point
 * needs somebody to save the application AGAINST.
 *
 * Three calls, in order:
 *   1. `POST /auth/signup` — creates the account and emails a verification link.
 *      It deliberately returns no session (rule #58): the answer is the same
 *      whether or not the address was already taken, so that this form cannot
 *      be used to find out who has an account here.
 *   2. `POST /auth/login` — so the wizard has a session to save into. The
 *      password was typed on this screen a moment ago; nothing is stored to
 *      make this possible.
 *   3. `PATCH /auth/me/profile` — the phone number from the previous screen,
 *      which signup does not take.
 *
 * The strength rule is the API's own `signupSchema`, not a local one. This
 * screen used to demand an uppercase letter and a digit that `/signup` does
 * not, so the same password was accepted on one page of this product and
 * refused on another.
 */
export default function CreatePasswordPage() {
  const { data: account, clear } = useAccountDraft()
  const router = useRouter()

  /*
   * The account screens hold their answers in memory, so a refresh here — or a
   * link straight to this URL — arrives with no email to sign up with. Sending
   * them back to the first screen is the only thing that can be done about it,
   * and it is one field.
   *
   * Latched at mount rather than watched. The store is emptied once the account
   * exists, and an effect still watching it would read that as "no email" and
   * throw the new partner back to the first screen on their way forward.
   */
  const startedWithEmail = React.useRef(Boolean(account.email))
  React.useEffect(() => {
    if (!startedWithEmail.current) router.replace("/join")
  }, [router])

  const login = useLogin()
  const updateProfile = useUpdateProfile()

  const [password, setPassword] = React.useState("")
  const [confirm, setConfirm] = React.useState("")

  async function createAccount() {
    const parsed = signupSchema.safeParse({
      email: account.email,
      password,
      firstName: account.firstName,
      lastName: account.lastName,
    })

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the details above")
      return false
    }
    if (password !== confirm) {
      toast.error("Passwords don't match")
      return false
    }

    try {
      await authApi.signup(parsed.data)
    } catch (error) {
      toast.error("Couldn't create the account", {
        description: error instanceof Error ? error.message : undefined,
      })
      return false
    }

    try {
      await login.mutateAsync({
        email: parsed.data.email,
        password,
        // Not a shared machine's problem to solve: this is a long form, but
        // "remember me" is a choice a partner makes at sign-in, not one made
        // for them by a registration flow.
        remember: false,
      })
    } catch {
      /*
       * Signup answers the same way for a taken address, so this is where a
       * second attempt with a different password surfaces — as a failed login,
       * which says nothing about the account beyond what the person typing
       * already knew.
       */
      toast.error("That email already has an account", {
        description: "Sign in with it and the application will pick up from there.",
      })
      return false
    }

    if (account.phone) {
      /*
       * Not fatal. The account exists and they are signed in; a phone number
       * that failed to attach is fixable from the profile screen, and blocking
       * the wizard here would strand somebody who now has an account they were
       * never told about.
       */
      try {
        await updateProfile.mutateAsync({ phone: account.phone })
      } catch {
        toast.warning("We couldn't save your phone number", {
          description: "You can add it from your profile later.",
        })
      }
    }

    clear()
    return true
  }

  return (
    <WizardShell
      aside={
        <TipPanel title="Creating a strong password">
          Length is what makes a password hard to guess — {PASSWORD_MIN}{" "}
          characters is the floor, and a few unrelated words beat a short one
          with symbols swapped in. Avoid anything you use elsewhere, and
          consider a password manager.
        </TipPanel>
      }
    >
      <Card>
        <CardContent className="pt-6">
          <StepHeading
            title="Create password"
            description={`Use at least ${PASSWORD_MIN} characters. A passphrase of a few unrelated words is both stronger and easier to remember.`}
          />
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
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
                autoComplete="new-password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>

          <StepNav
            slug="password"
            nextLabel="Create account"
            nextDisabled={!password || !confirm}
            onContinue={createAccount}
          />

          <p className="text-muted-foreground mt-4 text-center text-xs">
            By creating an account, you agree to our{" "}
            <Link href="/terms" className="hover:text-foreground underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="hover:text-foreground underline">
              Privacy Policy
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </WizardShell>
  )
}
