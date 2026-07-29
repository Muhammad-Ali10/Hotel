import type { Metadata } from "next"
import Link from "next/link"
import {
  BadgeCheck,
  ChartLine,
  CircleCheck,
  Gem,
  Headset,
  Percent,
  Plane,
  UserCheck,
  Users,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Travel Agents · Stayora",
  description:
    "Book curated luxury stays for your clients with agent rates, guaranteed commission and a dedicated trade desk at Stayora.",
}

const benefits: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Percent,
    title: "Guaranteed 10% commission",
    description:
      "On every completed stay booked through your agent account, across the full portfolio — no excluded properties and no seasonal carve-outs.",
  },
  {
    icon: Headset,
    title: "A dedicated trade desk",
    description:
      "A direct line to agents-only support, staffed 7 days a week. No consumer queue and no explaining the booking from scratch.",
  },
  {
    icon: Users,
    title: "Multi-client management",
    description:
      "Hold client profiles, preferences and passport details in one place, then apply them to any booking in a couple of clicks.",
  },
  {
    icon: Gem,
    title: "Amenities for your clients",
    description:
      "Room upgrades where available, welcome amenities and early check-in requests flagged as trade bookings and prioritised by the property.",
  },
  {
    icon: ChartLine,
    title: "Statements that reconcile",
    description:
      "Commission statements itemised by client, booking and stay date, exportable to CSV for your back office.",
  },
  {
    icon: Plane,
    title: "Familiarisation rates",
    description:
      "Reduced agent rates at participating properties so you can sell somewhere you have actually seen.",
  },
]

const steps: { step: string; title: string; description: string }[] = [
  {
    step: "01",
    title: "Register your agency",
    description:
      "Send us your trading name, IATA, TIDS or CLIA number, and the consultants who need access.",
  },
  {
    step: "02",
    title: "Verification",
    description:
      "We confirm your credentials with the issuing body. Most agencies are approved within two working days.",
  },
  {
    step: "03",
    title: "Book",
    description:
      "Agent rates and commission appear on every search. Book on behalf of a client and the confirmation goes to both of you.",
  },
  {
    step: "04",
    title: "Get paid",
    description:
      "Commission is released 14 days after each client checks out and settled monthly against your statement.",
  },
]

const requirements: string[] = [
  "A valid IATA, TIDS, CLIA or recognised national trade accreditation",
  "A registered trading entity, with the tax details we need to pay commission",
  "At least one named consultant responsible for bookings made on the account",
  "Agreement to our trade terms, including the client data-handling requirements",
]

export default function TravelAgentsPage() {
  return (
    <div>
      {/* HERO */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
          <Badge variant="secondary" className="mx-auto">
            <BadgeCheck className="size-3" />
            Travel Agents
          </Badge>
          <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            The trade programme for advisors who sell luxury
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg text-pretty">
            Agent rates across 2,400 curated properties, 10% commission on every
            completed stay, and a trade desk that answers the phone. Free to
            join, no volume commitment.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              render={
                <a href="mailto:trade@stayora.com?subject=Travel%20agent%20registration">
                  Register your agency
                </a>
              }
            />
            <Button
              variant="outline"
              render={<a href="#how-it-works">How it works</a>}
            />
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            What agents get
          </h2>
          <p className="text-muted-foreground mt-2">
            Built around how advisors actually work, not adapted from the
            consumer site.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map((benefit) => {
            const Icon = benefit.icon
            return (
              <Card key={benefit.title}>
                <CardContent className="flex h-full flex-col gap-3">
                  <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-heading font-semibold">{benefit.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="scroll-mt-24 border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              How it works
            </h2>
            <p className="text-muted-foreground mt-2">
              Registration to first commission payment.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((item) => (
              <Card key={item.step}>
                <CardContent className="flex h-full flex-col gap-2">
                  <span className="font-heading text-muted-foreground text-2xl font-semibold tabular-nums">
                    {item.step}
                  </span>
                  <h3 className="font-heading font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* REQUIREMENTS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              What you need to register
            </h2>
            <p className="text-muted-foreground mt-2">
              Have these to hand and registration takes about ten minutes.
            </p>
            <ul className="mt-6 space-y-3">
              {requirements.map((requirement) => (
                <li key={requirement} className="flex items-start gap-3">
                  <CircleCheck className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <span className="text-muted-foreground text-sm leading-relaxed">
                    {requirement}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col justify-center gap-3 rounded-xl border bg-muted/30 p-8">
            <UserCheck className="text-muted-foreground size-6" />
            <h3 className="font-heading text-lg font-semibold">
              Already registered?
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Sign in to your agent account to see trade rates and manage client
              bookings. Consultants at an approved agency can be added by your
              account owner at any time.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              <Button render={<Link href="/login">Sign in</Link>} />
              <Button
                variant="outline"
                render={<a href="mailto:trade@stayora.com">Contact the trade desk</a>}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
