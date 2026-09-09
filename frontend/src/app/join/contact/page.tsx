"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useAccountDraft } from "../_lib/account-store"

/**
 * Held in memory until the password screen creates the account — there is no
 * server-side draft to save into until an account exists.
 *
 * The two-factor copy that used to justify this screen has gone. There is no
 * 2FA in this product: no enrolment, no challenge at login, and SMS is not one
 * of the channels the platform can send on. Telling a partner their phone
 * number secures their account, and that a code will arrive when they sign in
 * from a new device, was a security promise nothing behind it kept.
 */
export default function ContactDetailsPage() {
  const { data, update } = useAccountDraft()
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
  const startedWithEmail = React.useRef(Boolean(data.email))
  React.useEffect(() => {
    if (!startedWithEmail.current) router.replace("/join")
  }, [router])

  const [firstName, setFirstName] = React.useState(data.firstName)
  const [lastName, setLastName] = React.useState(data.lastName)
  const [phone, setPhone] = React.useState(data.phone)

  return (
    <WizardShell
      aside={
        <TipPanel title="Why we ask for your phone number">
          It is how the platform reaches you about your application and, once
          you are live, about anything urgent on a booking. It is never shown to
          guests — they message you through the platform, so your number stays
          yours.
        </TipPanel>
      }
    >
      <Card>
        <CardContent className="pt-6">
          <StepHeading
            title="Contact details"
            description="Your name goes on the partner agreement, and the phone number is how we reach you about your application."
          />
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  placeholder="Ahmed"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  placeholder="Khan"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              {/* No baked-in +92. The country prefix was fixed to Pakistan on a
                  marketplace whose properties are in Dubai, London and Bali —
                  a partner in any of them could not enter their own number. */}
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                placeholder="+971 50 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Include the country code, so we can reach you wherever the
                property is.
              </p>
            </div>
          </div>

          <StepNav
            slug="contact"
            nextLabel="Next"
            nextDisabled={!firstName.trim() || !lastName.trim()}
            onContinue={() =>
              update({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
              })
            }
          />
        </CardContent>
      </Card>
    </WizardShell>
  )
}
