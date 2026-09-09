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
import { PlatformStats } from "../_components/platform-stats"

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Stayora curates the world's finest hotels and resorts. Meet the team, the standards we hold properties to, and the idea behind the platform.",
}

/*
 * Four things the platform actually does, replacing four it did not.
 *
 *   · "Every property is visited and assessed" — there is no site visit. What
 *     is real is the application review: ownership, identity, rooms and rates,
 *     read by a person before a listing exists at all.
 *   · "Our travel specialists have stayed in the properties they support" and
 *     "a person who knows the hotel picks up at midnight" — a staffing promise
 *     with no rota, no on-call anything, and no 24-hour desk.
 *   · "We give properties with environmental programmes prominence in search"
 *     — the ranking has five factors and none of them is sustainability. That
 *     is a claim about how search works, which is the easiest kind to check
 *     and the worst kind to get wrong.
 *
 * The one that stayed is the one that was true.
 */
const values: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Gem,
    title: "Reviewed before it is listed",
    description:
      "No property lists itself. Ownership, licences and every room and rate are read by the platform before a listing goes live — and a listing that changes materially is read again.",
  },
  {
    icon: Handshake,
    title: "The price you see is the price you pay",
    description:
      "Nothing is added at checkout. No cleaning fee, no service charge, no tax line appearing on the last screen — the nightly rate a property sets is the nightly rate you are charged.",
  },
  {
    icon: Compass,
    title: "Cancellation terms in plain words",
    description:
      "Every rate carries its own deadline and its own charge, written out before you book and calculated the same way if you cancel. What you are quoted at cancellation is what the policy said.",
  },
  {
    icon: Leaf,
    title: "Search you cannot buy your way up",
    description:
      "Ranking is quality, guest rating, how often a listing converts, price and availability. Price is the smallest part of it, and no amount of money moves a property up the list.",
  },
]

/*
 * The four figures that used to live here — "2,400+ curated properties", "68
 * countries", "1.2M stays booked", "4.8/5 average guest rating" — were typed
 * into this file over a catalogue of eight properties in two countries with no
 * published reviews. `<PlatformStats />` counts them instead (rule #113).
 */

/*
 * The company history that used to sit here — founded 2019, three hundred
 * partners by 2021, "points on every completed stay", a 24-hour concierge desk,
 * and 2,400 properties across 68 countries by 2026 — has gone with the section
 * that rendered it. None of it is in this system and none of it can be checked;
 * `users.points` has no earn or spend logic anywhere at all.
 *
 * It belongs back on this page the day somebody supplies the real dates.
 */

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
          <PlatformStats className="grid grid-cols-2 gap-8 lg:grid-cols-4" />
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
