import type { Metadata } from "next"
import Link from "next/link"
import {
  ChartLine,
  CircleCheck,
  Clock3,
  Coins,
  Link2,
  Megaphone,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata: Metadata = {
  title: "Affiliate Program · Stayora",
  description:
    "Earn commission promoting curated luxury stays. Transparent tiers, a 45-day cookie window and monthly payouts from the Stayora affiliate program.",
}

const highlights: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Coins,
    title: "Up to 8% commission",
    description:
      "Paid on the net booking value of every completed stay, with tiers that rise as your monthly volume grows.",
  },
  {
    icon: Clock3,
    title: "45-day attribution",
    description:
      "Luxury travel is researched slowly. Our cookie window reflects that, so a booking made six weeks later still credits you.",
  },
  {
    icon: ChartLine,
    title: "Live reporting",
    description:
      "Clicks, bookings, cancellations and confirmed earnings in a dashboard that updates hourly — not a monthly spreadsheet.",
  },
  {
    icon: Link2,
    title: "Deep links to anything",
    description:
      "Link straight to a property, a destination search, or a filtered result set. Every URL on Stayora is trackable.",
  },
  {
    icon: Megaphone,
    title: "Creative that converts",
    description:
      "Banners, property imagery and seasonal copy kits, refreshed quarterly and cleared for commercial use.",
  },
  {
    icon: Wallet,
    title: "Monthly payouts",
    description:
      "Paid on the 15th for the preceding month once stays have completed, by bank transfer or PayPal. £50 minimum.",
  },
]

const tiers: {
  tier: string
  bookings: string
  commission: string
  extras: string
}[] = [
  {
    tier: "Standard",
    bookings: "1 – 9 per month",
    commission: "4%",
    extras: "Dashboard, deep links, creative library",
  },
  {
    tier: "Silver",
    bookings: "10 – 29 per month",
    commission: "5.5%",
    extras: "Everything in Standard, plus early access to seasonal offers",
  },
  {
    tier: "Gold",
    bookings: "30 – 99 per month",
    commission: "7%",
    extras: "Named affiliate manager and custom landing pages",
  },
  {
    tier: "Signature",
    bookings: "100+ per month",
    commission: "8%",
    extras: "Negotiated rates, co-branded campaigns, API access",
  },
]

const steps: { step: string; title: string; description: string }[] = [
  {
    step: "01",
    title: "Apply",
    description:
      "Tell us where you publish and who reads it. We review every application by hand, usually within three working days.",
  },
  {
    step: "02",
    title: "Get your links",
    description:
      "Your dashboard opens with a tracking ID, deep-link builder and the full creative library.",
  },
  {
    step: "03",
    title: "Publish",
    description:
      "Place links in reviews, guides, newsletters or social. Disclose the relationship — it is required, and it converts better anyway.",
  },
  {
    step: "04",
    title: "Get paid",
    description:
      "Commission confirms once the guest checks out, and pays on the 15th of the following month.",
  },
]

const eligibility: string[] = [
  "A live website, newsletter or social channel with a genuine travel audience",
  "Original content — we do not accept coupon aggregators or scraped listings",
  "Clear affiliate disclosure wherever links appear",
  "No bidding on Stayora brand terms in paid search",
]

export default function AffiliateProgramPage() {
  return (
    <div>
      {/* HERO */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
          <Badge variant="secondary" className="mx-auto">
            <Coins className="size-3" />
            Affiliate Program
          </Badge>
          <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Earn from the stays you already recommend
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg text-pretty">
            If your audience travels well, our commission tiers reward it. Up to
            8% on completed stays, a 45-day attribution window, and reporting you
            can actually reconcile.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button
              render={
                <a href="mailto:affiliates@stayora.com?subject=Affiliate%20application">
                  Apply to the program
                </a>
              }
            />
            <Button variant="outline" render={<a href="#tiers">See commission tiers</a>} />
          </div>
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            What the program gives you
          </h2>
          <p className="text-muted-foreground mt-2">
            Built for publishers who write about travel seriously.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item) => {
            const Icon = item.icon
            return (
              <Card key={item.title}>
                <CardContent className="flex h-full flex-col gap-3">
                  <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-heading font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* TIERS */}
      <section id="tiers" className="scroll-mt-24 border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              Commission tiers
            </h2>
            <p className="text-muted-foreground mt-2">
              Assessed monthly on completed stays. Tiers move up immediately and
              only ever fall after two consecutive quiet months.
            </p>
          </div>
          <Card className="mt-8">
            <CardContent className="overflow-x-auto px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tier</TableHead>
                    <TableHead>Completed bookings</TableHead>
                    <TableHead>Commission</TableHead>
                    <TableHead>Includes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((tier) => (
                    <TableRow key={tier.tier}>
                      <TableCell className="font-heading font-semibold">
                        {tier.tier}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tier.bookings}
                      </TableCell>
                      <TableCell className="font-medium tabular-nums">
                        {tier.commission}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {tier.extras}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-muted-foreground mt-4 text-sm">
            Commission is calculated on net booking value excluding taxes and
            property-collected fees, and confirms after the guest checks out.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            How it works
          </h2>
          <p className="text-muted-foreground mt-2">
            Four steps from application to first payout.
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
      </section>

      {/* ELIGIBILITY */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-heading text-3xl font-semibold tracking-tight">
                Who can join
              </h2>
              <p className="text-muted-foreground mt-2">
                We review every application individually rather than approving
                automatically.
              </p>
              <ul className="mt-6 space-y-3">
                {eligibility.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CircleCheck className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                    <span className="text-muted-foreground text-sm leading-relaxed">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center gap-3 rounded-xl border bg-card p-8">
              <h3 className="font-heading text-lg font-semibold">
                Ready to apply?
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Send us a link to where you publish and a line about your
                audience. We reply within three working days, either way.
              </p>
              <div className="mt-2 flex flex-wrap gap-3">
                <Button
                  render={
                    <a href="mailto:affiliates@stayora.com?subject=Affiliate%20application">
                      Apply now
                    </a>
                  }
                />
                <Button
                  variant="outline"
                  render={<Link href="/support">Ask a question</Link>}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
