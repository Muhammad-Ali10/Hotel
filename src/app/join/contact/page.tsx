"use client"

import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { TipPanel } from "../_components/tip-panel"
import { StepNav } from "../_components/step-nav"
import { useWizard } from "../_components/wizard-provider"

export default function ContactDetailsPage() {
  const { data, update } = useWizard()
  const [firstName, setFirstName] = React.useState(data.firstName)
  const [lastName, setLastName] = React.useState(data.lastName)
  const [phone, setPhone] = React.useState(data.phone)

  return (
    <WizardShell
      aside={
        <TipPanel title="Why we ask for your phone number">
          We use your phone number for two-factor authentication (2FA) to keep
          your account secure. You&apos;ll receive a code via SMS each time you
          sign in from a new device. We never share your number with guests.
        </TipPanel>
      }
    >
      <Card>
        <CardContent className="pt-6">
          <StepHeading
            title="Contact details"
            description="We need your name and phone number for account security and two-factor authentication."
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
              <div className="flex items-stretch gap-2">
                <span className="bg-muted text-muted-foreground flex items-center gap-1.5 rounded-lg border px-3 text-sm">
                  <span className="font-medium">PK</span> +92
                </span>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="300 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="flex-1"
                />
              </div>
              <p className="text-muted-foreground text-xs">
                We&apos;ll text a two-factor authentication code to this number
                when you sign in.
              </p>
            </div>
          </div>

          <StepNav
            slug="contact"
            nextLabel="Next"
            onContinue={() => update({ firstName, lastName, phone })}
          />
        </CardContent>
      </Card>
    </WizardShell>
  )
}
