import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  Building2,
  ChartLine,
  CircleCheck,
  Handshake,
  Percent,
  ShieldCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { hotelImage } from "@/lib/images"

export const metadata: Metadata = {
  title: "Hotel Partners · Stayora",
  description:
    "Partner with Stayora to reach high-intent luxury travellers. Transparent commission, direct guest relationships and a full revenue extranet.",
}

const benefits: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Users,
    title: "High-intent guests",
    description:
      "Our audience arrives ready to book a considered trip. Average booking value is 3.4× the industry norm and cancellation rates run well below it.",
  },
  {
    icon: Percent,
    title: "Commission you can predict",
    description:
      "A flat rate agreed up front, with no bidding for placement and no charge for the traffic that does not convert. What you sign is what you pay.",
  },
  {
    icon: ChartLine,
    title: "A real revenue toolkit",
    description:
      "Rate calendars, restrictions, competitor benchmarking, pace and demand data — the same analytics our own commercial team works from.",
  },
  {
    icon: Wallet,
    title: "Payouts on a fixed cycle",
    description:
      "Settled twice monthly with itemised statements, so reconciliation takes minutes rather than an afternoon.",
  },
  {
    icon: ShieldCheck,
    title: "Fraud handled for you",
    description:
      "Payment verification, chargeback defence and guest identity checks sit with us. You receive confirmed, screened reservations.",
  },
  {
    icon: Handshake,
    title: "A named partner manager",
    description:
      "One person who knows your property, your season and your rate strategy — not a ticket queue and a different name each time.",
  },
]

const steps: { step: string; title: string; description: string }[] = [
  {
    step: "01",
    title: "Apply",
    description:
      "Tell us about the property: rooms, location, positioning and the rates you want to sell.",
  },
  {
    step: "02",
    title: "Assessment",
    description:
      "One of our assessors visits and stays. We are looking for consistency and a genuine sense of place, not a star count.",
  },
  {
    step: "03",
    title: "Onboarding",
    description:
      "We build your listing, load rooms and rate plans, and connect your channel manager or PMS. Typically under two weeks.",
  },
  {
    step: "04",
    title: "Go live",
    description:
      "Your property appears in search and your extranet opens. Your partner manager reviews performance with you monthly.",
  },
]

const requirements: string[] = [
  "A distinct point of view — design, location, service or history that a guest would travel for",
  "Consistent service standards across the full inventory you intend to sell with us",
  "Accurate, current photography and honest room descriptions",
  "Rate parity with your own direct channel, and published cancellation terms",
  "A channel manager or PMS we can connect to, or willingness to work in the extranet directly",
]

export default function HotelPartnersPage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b">
        <Image
          src={hotelImage("partner-hotels-hero", 1920, 900)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-black/40" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8 lg:py-28">
          <Badge variant="secondary" className="mx-auto">
            <Building2 className="size-3" />
            Hotel Partners
          </Badge>
          <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
            Reach travellers who are already looking for you
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-pretty text-white/80">
            Stayora sends high-intent guests to properties worth the journey —
            on transparent commission, with the data and support to build real
            revenue rather than volume.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button render={<Link href="/join">List your property</Link>} />
            <Button
              variant="outline"
              render={<a href="mailto:partners@stayora.com">Talk to partnerships</a>}
            />
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            Why partner with Stayora
          </h2>
          <p className="text-muted-foreground mt-2">
            What you get beyond a listing.
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
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              How it works
            </h2>
            <p className="text-muted-foreground mt-2">
              From application to first booking, usually inside a month.
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
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              What we look for
            </h2>
            <p className="text-muted-foreground mt-2">
              We accept a minority of the properties that apply. These are the
              things that decide it.
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
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
            <Image
              src={hotelImage("partner-hotels-standard", 900, 700)}
              alt="A Stayora partner property"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Handshake className="text-muted-foreground size-6" />
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Start the conversation
            </h2>
            <p className="text-muted-foreground max-w-lg text-sm">
              Begin the listing process online, or speak to our partnerships team
              first if you would rather talk it through.
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              <Button render={<Link href="/join">List your property</Link>} />
              <Button
                variant="outline"
                render={
                  <a href="mailto:partners@stayora.com">partners@stayora.com</a>
                }
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
