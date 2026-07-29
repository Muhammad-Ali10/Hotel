import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import {
  Compass,
  Gem,
  Globe,
  Handshake,
  Leaf,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { hotelImage } from "@/lib/images"

export const metadata: Metadata = {
  title: "About Us · Stayora",
  description:
    "Stayora curates the world's finest hotels and resorts. Meet the team, the standards we hold properties to, and the idea behind the platform.",
}

const values: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Gem,
    title: "Curated, not catalogued",
    description:
      "Every property is visited and assessed before it joins Stayora. We would rather list four hundred hotels we believe in than forty thousand we have never seen.",
  },
  {
    icon: Handshake,
    title: "Honest by default",
    description:
      "The price you see is the price you pay. Rate conditions, cancellation deadlines and property fees are on the room card — not buried three screens into checkout.",
  },
  {
    icon: Compass,
    title: "Concierge, not call centre",
    description:
      "Our travel specialists have stayed in the properties they support. When a booking needs rescuing at midnight, a person who knows the hotel picks up.",
  },
  {
    icon: Leaf,
    title: "Lighter on the places we love",
    description:
      "We favour properties with credible environmental programmes and give them prominence in search, because the destinations we sell are worth protecting.",
  },
]

const stats: { value: string; label: string }[] = [
  { value: "2,400+", label: "Curated properties" },
  { value: "68", label: "Countries" },
  { value: "1.2M", label: "Stays booked" },
  { value: "4.8/5", label: "Average guest rating" },
]

const milestones: { year: string; title: string; description: string }[] = [
  {
    year: "2019",
    title: "An index of eleven hotels",
    description:
      "Stayora began as a private list our founders kept for friends — the eleven hotels they would actually recommend without hedging.",
  },
  {
    year: "2021",
    title: "The platform opens",
    description:
      "Direct partnerships with 300 independent properties, instant confirmation, and a policy that every rate must state its terms in plain language.",
  },
  {
    year: "2023",
    title: "Rewards and the concierge desk",
    description:
      "Points on every completed stay, and a 24-hour support desk staffed by specialists assigned to regions rather than queues.",
  },
  {
    year: "2026",
    title: "2,400 properties, 68 countries",
    description:
      "Still curated one property at a time, with the same standard: would we send someone we like here?",
  },
]

export default function AboutPage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b">
        <Image
          src={hotelImage("about-stayora", 1920, 900)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/60 to-black/40" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 text-center sm:px-6 lg:px-8 lg:py-32">
          <Badge variant="secondary" className="mx-auto">
            <Sparkles className="size-3" />
            About Stayora
          </Badge>
          <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl">
            We only list hotels we would book ourselves
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-pretty text-white/80">
            Stayora is a curated marketplace for luxury stays. No endless
            scrolling, no rate you cannot understand — just properties worth the
            journey and a team that knows them.
          </p>
        </div>
      </section>

      {/* STORY */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              Our story
            </h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Stayora started with a frustration our founders kept running into:
              booking a genuinely good hotel took hours of cross-referencing
              review sites, and the result was still a gamble. The listings that
              ranked highest were rarely the ones worth staying in — they were
              simply the ones paying the most for placement.
            </p>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              So we built the opposite. Properties earn their place on Stayora by
              being assessed in person against a fixed standard, and search
              results are never sold. A hotel appears above another because it
              suits the traveller better, not because it bid higher.
            </p>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              Seven years on, that principle has not moved. We are deliberately
              smaller than the platforms we compete with, and that is the point —
              a curated list is only useful if someone is willing to leave things
              off it.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button render={<Link href="/hotels">Explore hotels</Link>} />
              <Button
                variant="outline"
                render={<Link href="/careers">Join the team</Link>}
              />
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
            <Image
              src={hotelImage("about-story", 900, 700)}
              alt="A curated Stayora property"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
                  {stat.value}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            What we stand for
          </h2>
          <p className="text-muted-foreground mt-2">
            Four commitments that decide what gets listed and how it is sold.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {values.map((value) => {
            const Icon = value.icon
            return (
              <Card key={value.title}>
                <CardContent className="flex items-start gap-4">
                  <span className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl">
                    <Icon className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-heading font-semibold">{value.title}</h3>
                    <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* MILESTONES */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              How we got here
            </h2>
            <p className="text-muted-foreground mt-2">
              From a private list of eleven hotels to a marketplace in 68
              countries.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {milestones.map((milestone) => (
              <Card key={milestone.year}>
                <CardContent className="flex h-full flex-col gap-2">
                  <Badge variant="outline" className="w-fit">
                    {milestone.year}
                  </Badge>
                  <h3 className="font-heading font-semibold">
                    {milestone.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {milestone.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/30 p-10 text-center">
          <Globe className="text-muted-foreground size-6" />
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Somewhere worth the journey
          </h2>
          <p className="text-muted-foreground max-w-lg text-sm">
            Browse the collection, or talk to a specialist who has actually
            stayed where you are heading.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Button render={<Link href="/hotels">Browse hotels</Link>} />
            <Button
              variant="outline"
              render={<Link href="/support">Talk to us</Link>}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
