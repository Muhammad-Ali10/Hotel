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

export const metadata: Metadata = {
  title: "Press · Stayora",
  description:
    "Press resources, company facts and media contacts for Stayora — the curated marketplace for luxury hotel stays.",
}

const facts: { label: string; value: string }[] = [
  { label: "Founded", value: "2019" },
  { label: "Headquarters", value: "London, United Kingdom" },
  { label: "Curated properties", value: "2,400+ across 68 countries" },
  { label: "Team", value: "180 people in 14 countries" },
  { label: "Stays booked", value: "1.2 million since launch" },
  { label: "Average guest rating", value: "4.8 out of 5" },
]

const coverage: {
  outlet: string
  headline: string
  date: string
  kind: string
}[] = [
  {
    outlet: "The Continental Review",
    headline:
      "The booking platform that turned down more hotels than it listed",
    date: "May 2026",
    kind: "Feature",
  },
  {
    outlet: "Hospitality Quarterly",
    headline: "Curation as a business model: inside Stayora's assessment process",
    date: "March 2026",
    kind: "Analysis",
  },
  {
    outlet: "Traveller & Co.",
    headline: "Where to stay in 2026, according to the people who vet the rooms",
    date: "January 2026",
    kind: "Interview",
  },
  {
    outlet: "Northbound Business",
    headline: "Stayora expands its partner network across the Gulf",
    date: "November 2025",
    kind: "News",
  },
]

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
            Current as of the last update to this page. Please check with the
            press office before publishing figures.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((fact) => (
            <Card key={fact.label}>
              <CardContent>
                <p className="text-muted-foreground text-sm">{fact.label}</p>
                <p className="font-heading mt-1 font-semibold">{fact.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 rounded-xl border bg-muted/30 p-6">
          <h3 className="font-heading font-semibold">Boilerplate</h3>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            Stayora is a curated marketplace for luxury accommodation. Founded in
            2019 and headquartered in London, it lists more than 2,400 hotels,
            resorts and private properties across 68 countries, each assessed in
            person before being accepted. Stayora does not sell search placement,
            and publishes full rate conditions on every room it offers.
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

      {/* COVERAGE */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            Recent coverage
          </h2>
          <p className="text-muted-foreground mt-2">
            A selection of what has been written about us lately.
          </p>
        </div>
        <div className="mt-8 space-y-3">
          {coverage.map((item) => (
            <Card key={item.headline}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-sm font-semibold">
                      {item.outlet}
                    </span>
                    <Badge variant="outline">{item.kind}</Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 leading-relaxed">
                    {item.headline}
                  </p>
                </div>
                <span className="text-muted-foreground shrink-0 text-sm">
                  {item.date}
                </span>
              </CardContent>
            </Card>
          ))}
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
