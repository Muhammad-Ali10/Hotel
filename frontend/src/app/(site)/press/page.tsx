import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowUpRight,
  Download,
  Mail,
  Newspaper,
  Quote,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PlatformStats } from "../_components/platform-stats"

export const metadata: Metadata = {
  title: "Press",
  description:
    "Press resources, company facts and media contacts for Stayora — the curated marketplace for luxury hotel stays.",
}

/*
 * The six "company facts" that used to be here were written into this file:
 * founded 2019, headquartered in London, 2,400+ properties across 68 countries,
 * 180 people in 14 countries, 1.2 million stays, 4.8 out of 5 — under a heading
 * that invited journalists to publish them.
 *
 * The catalogue holds eight properties in two countries and has no published
 * reviews. What is countable is counted by `<PlatformStats />`; the founding
 * date, the head office and the headcount are not in this system at all, and a
 * press page is the last place to guess at them.
 */

/*
 * Four press mentions used to be listed here — The Continental Review,
 * Hospitality Quarterly, Traveller & Co., Northbound Business — with headlines,
 * dates and section labels. None of those publications wrote them, because none
 * of them exist.
 *
 * Invented coverage is not placeholder copy. It is a claim that independent
 * journalists have examined this business and approved of it, which is the one
 * thing a press page exists to establish and the one thing it cannot fabricate.
 *
 * The section comes back with real cuttings, or not at all.
 */

const kit: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Download,
    title: "Logo and wordmark",
    description:
      "Primary and monochrome marks in SVG and PNG, with clear-space and minimum-size guidance.",
  },
  {
    icon: Newspaper,
    title: "Brand guidelines",
    description:
      "Typography, palette and tone-of-voice reference, plus how to write our name in copy.",
  },
  {
    icon: Quote,
    title: "Executive bios and headshots",
    description:
      "Approved biographies and high-resolution portraits for our leadership team.",
  },
]

export default function PressPage() {
  return (
    <div>
      {/* HERO */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
          <Badge variant="secondary" className="mx-auto">
            <Newspaper className="size-3" />
            Press
          </Badge>
          <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Press &amp; media
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg text-pretty">
            Everything you need to write about Stayora accurately — company
            facts, brand assets, and a press office that answers the same day.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              render={
                <a href="mailto:press@stayora.com">
                  <Mail className="size-4" />
                  Contact the press office
                </a>
              }
            />
            <Button variant="outline" render={<a href="#press-kit">Press kit</a>} />
          </div>
        </div>
      </section>

      {/* COMPANY FACTS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            Company facts
          </h2>
          <p className="text-muted-foreground mt-2">
            {/* Counted live, rather than "current as of the last update to this
                page" — which is how a stale figure ends up in print. */}
            Counted from the live catalogue, now. Anything else — the company&apos;s
            registered details, its history, who to quote — comes from the press
            office below.
          </p>
        </div>
        <PlatformStats className="mt-8 grid grid-cols-2 gap-8 lg:grid-cols-4" />

        <div className="mt-8 rounded-xl border bg-muted/30 p-6">
          <h3 className="font-heading font-semibold">Boilerplate</h3>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            {/* Only what the platform can be held to. The founding date, the
                head office and "each assessed in person" have gone; the last
                two claims were true and have stayed. */}
            Stayora is a curated marketplace for luxury accommodation. Every
            property is reviewed by the platform — ownership, licences, rooms and
            rates — before its listing goes live. Stayora does not sell search
            placement, publishes the full conditions of every rate it offers, and
            adds nothing to a nightly price at checkout.
          </p>
        </div>
      </section>

      {/* PRESS KIT */}
      <section id="press-kit" className="scroll-mt-24 border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              Press kit
            </h2>
            <p className="text-muted-foreground mt-2">
              Request any of the following from the press office and we will send
              it across the same working day.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {kit.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.title} className="group">
                  <CardContent className="flex h-full flex-col gap-3">
                    <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="font-heading font-semibold">{item.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.description}
                    </p>
                    <div className="mt-auto pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        render={
                          <a
                            href={`mailto:press@stayora.com?subject=${encodeURIComponent(
                              `Press kit request — ${item.title}`
                            )}`}
                          >
                            Request
                            <ArrowUpRight className="size-4" />
                          </a>
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <Mail className="text-muted-foreground size-6" />
            <h2 className="font-heading text-2xl font-semibold tracking-tight">
              Media enquiries
            </h2>
            <p className="text-muted-foreground max-w-lg text-sm">
              For interviews, data requests or comment, reach the press office at{" "}
              <a
                href="mailto:press@stayora.com"
                className="text-foreground hover:underline"
              >
                press@stayora.com
              </a>
              . We aim to respond within four working hours.
            </p>
            <p className="text-muted-foreground max-w-lg text-sm">
              Guest or booking questions are handled separately — please use the{" "}
              <Link href="/support" className="text-foreground hover:underline">
                Help Center
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
