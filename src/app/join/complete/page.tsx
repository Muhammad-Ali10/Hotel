"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { WizardShell, StepHeading } from "../_components/wizard-shell"
import { SelectCard } from "../_components/select-card"
import { useWizard } from "../_components/wizard-provider"
import { href, prevStep } from "../_lib/steps"

const countries = ["Pakistan", "United Arab Emirates", "Saudi Arabia", "United Kingdom", "United States"].map(
  (v) => ({ value: v, label: v }),
)

const perks = [
  "Manage your property calendar and rates from a single dashboard",
  "Get bookings from millions of travelers worldwide",
  "Sync availability across channels to eliminate double bookings",
]

export default function CompleteRegistrationPage() {
  const router = useRouter()
  const { data, update } = useWizard()
  const [contractType, setContractType] = React.useState<"individual" | "business" | null>(
    data.contractType,
  )
  const [hostType, setHostType] = React.useState<"private" | "professional" | null>(data.hostType)
  const [certified, setCertified] = React.useState(false)
  const [agreed, setAgreed] = React.useState(false)

  function complete() {
    if (!hostType) {
      toast.error("Tell us whether you're a private or professional host")
      return
    }
    if (!certified || !agreed) {
      toast.error("Please accept both agreements to continue")
      return
    }
    update({ contractType, hostType, agreedToTerms: true })
    toast.success("Registration complete")
    router.push(href("done"))
  }

  function notReady() {
    const prev = prevStep("complete")
    if (prev) router.push(href(prev.path))
  }

  return (
    <WizardShell>
      <StepHeading
        title="Complete registration"
        description="Are you listing the property as a business or an individual? This determines how your profile and contract are structured. Make sure it matches your legal status."
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
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">
              Personal information of the contracting party
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-first">
                  First name as stated on ID <span className="text-destructive">*</span>
                </Label>
                <Input id="c-first" placeholder="First name" defaultValue={data.firstName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-middle">Middle name</Label>
                <Input id="c-middle" placeholder="Middle name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-last">
                  Last name as stated on ID <span className="text-destructive">*</span>
                </Label>
                <Input id="c-last" placeholder="Last name" defaultValue={data.lastName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input id="c-email" type="email" placeholder="email@example.com" defaultValue={data.email} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="c-phone">
                  Phone number <span className="text-destructive">*</span>
                </Label>
                <Input id="c-phone" type="tel" placeholder="+92 300 1234567" defaultValue={data.phone} />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold">
              Primary residence of the contracting party
            </h3>
            <div className="space-y-2">
              <Label htmlFor="c-country">
                Country / Region <span className="text-destructive">*</span>
              </Label>
              <Select items={countries} defaultValue={data.country}>
                <SelectTrigger id="c-country" className="w-full" size="default">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-addr1">
                Address line 1 <span className="text-destructive">*</span>
              </Label>
              <Input id="c-addr1" placeholder="Street address" defaultValue={data.street} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-addr2">Address line 2</Label>
              <Input id="c-addr2" placeholder="Apartment, suite, building" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="c-city">
                  City <span className="text-destructive">*</span>
                </Label>
                <Input id="c-city" placeholder="City" defaultValue={data.city} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-zip">
                  Zip code <span className="text-destructive">*</span>
                </Label>
                <Input id="c-zip" placeholder="Zip / Postal code" defaultValue={data.zip} />
              </div>
            </div>
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

          <section className="bg-muted/40 rounded-xl border p-4">
            <p className="text-sm font-semibold">You&apos;re almost done</p>
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
              <Checkbox className="mt-0.5" checked={certified} onCheckedChange={(v) => setCertified(!!v)} />
              <span className="text-muted-foreground">
                I certify that I operate a legitimate business and hold all
                required licenses, permits, and registrations to offer
                accommodation at this property.
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox className="mt-0.5" checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} />
              <span className="text-muted-foreground">
                I have read and agree to the{" "}
                <Link href="#" className="text-foreground underline">
                  Terms &amp; Conditions
                </Link>
                ,{" "}
                <Link href="#" className="text-foreground underline">
                  Privacy Policy
                </Link>
                , and{" "}
                <Link href="#" className="text-foreground underline">
                  Partner Agreement
                </Link>
                .
              </span>
            </label>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Button variant="outline" type="button" onClick={notReady}>
          I&apos;m not ready
        </Button>
        <Button
          type="button"
          onClick={complete}
          disabled={!contractType}
          className="flex-1"
        >
          Complete registration and open for bookings
        </Button>
      </div>
    </WizardShell>
  )
}
