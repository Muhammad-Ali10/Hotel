import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  BadgeCheck,
  Headset,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import { hotelImage } from "@/lib/images"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { HeroSearch } from "@/components/marketplace/hero-search"
import {
  DestinationGrid,
  LuxuryStrip,
  RecommendedStrip,
} from "./_components/home-sections"

/**
 * Four things this product actually does.
 *
 * The four it used to claim were mostly promises nothing keeps: a "Best Price
 * Guarantee — we'll match it" with no price-match anywhere in the system;
 * "Exclusive Perks — complimentary upgrades, spa credits" that nothing grants;
 * and a "24/7 Concierge", which is a staffing commitment rather than a
 * feature. The fourth, "every review comes from confirmed guests", was nearly
 * true and slightly too strong — a review can exist without a booking, which
 * is exactly why the badge marks the ones that cannot.
 *
 * These four are each enforced somewhere in the code, and the rule is named.
 */
const WHY_CHOOSE_US: { title: string; description: string; icon: LucideIcon }[] = [
  {
    title: "The price is the price",
    description:
      "Nothing is added at checkout — no service charge, no cleaning fee, no resort fee. The nightly rate you are shown is what the card is charged.",
    icon: Receipt,
  },
  {
    title: "Reviews tied to real stays",
    description:
      "A review carries a Verified badge only when it belongs to a booking that actually happened. Properties cannot hide the ones they dislike — only the platform moderates.",
    icon: BadgeCheck,
  },
  {
    title: "Cancellation terms before you pay",
    description:
      "Every rate spells out what a cancellation costs and when, in the same words the refund is calculated from. Two rates on one room can differ, and both say so.",
    icon: ShieldCheck,
  },
  {
    title: "Support without an account",
    description:
      "You can write to us without signing in. The most common thing anybody needs help with is signing in, and a help desk behind a login cannot answer it.",
    icon: Headset,
  },
]

/**
 * The public home page.
 *
 * Two sections are deliberately absent, and both were removed rather than
 * rewritten because neither had anything real behind it:
 *
 *   - **Guest testimonials.** Three invented quotes with invented names and
 *     generated faces — fabricated social proof on the most public page in the
 *     product. Real reviews exist and are published per property; putting a
 *     rotating selection here needs an endpoint for "recently published across
 *     the marketplace", which does not exist yet. That is the honest way back.
 *   - **The newsletter form.** An email box and a Subscribe button wired to
 *     nothing: no list, no confirmation, no double opt-in. Collecting an
 *     address the product cannot store — and would need consent to mail — is
 *     worse than not asking (rule #56).
 */
export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b">
        <Image
          src={hotelImage("luxe-hero", 1920, 1000)}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-black/70" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl lg:text-5xl">
            Discover the World&apos;s Finest Hotels
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-white/85">
            Curated luxury accommodations for the discerning traveler.
            Unforgettable stays at the world&apos;s most prestigious addresses.
          </p>
          <div className="mx-auto mt-8 max-w-5xl">
            <HeroSearch />
          </div>
        </div>
      </section>

      {/* RECOMMENDED */}
      <Section
        title="Recommended"
        subtitle="What our search puts first — by quality, rating, price and availability"
        action={{ label: "View All", href: "/hotels" }}
      >
        <RecommendedStrip />
      </Section>

      {/* POPULAR DESTINATIONS */}
      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHead
            title="Popular Destinations"
            subtitle="Where we have properties, and how many"
            action={{ label: "Explore All", href: "/hotels" }}
          />
          <DestinationGrid />
        </div>
      </section>

      {/* LUXURY COLLECTION */}
      <Section
        title="Luxury Collection"
        subtitle="Every five-star property on the marketplace"
        action={{ label: "View Collection", href: "/hotels" }}
      >
        <LuxuryStrip />
      </Section>

      {/* WHY CHOOSE US */}
      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              Why Choose Us
            </h2>
            <p className="text-muted-foreground mt-2">
              Four things we can point at in the product, rather than four
              things that sound good on a home page.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_CHOOSE_US.map((f) => {
              const Icon = f.icon
              return (
                <Card key={f.title}>
                  <CardContent className="space-y-3">
                    <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="font-heading font-semibold">{f.title}</h3>
                    <p className="text-muted-foreground text-sm">{f.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

    </>
  )
}

function Section({
  title,
  subtitle,
  action,
  children,
}: {
  title: string
  subtitle: string
  action?: { label: string; href: string }
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHead title={title} subtitle={subtitle} action={action} />
        <div className="mt-8">{children}</div>
      </div>
    </section>
  )
}

function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle: string
  action?: { label: string; href: string }
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="font-heading text-3xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {action ? (
        <Button
          variant="ghost"
          size="sm"
          render={
            <Link href={action.href}>
              {action.label}
              <ArrowRight className="size-4" />
            </Link>
          }
        />
      ) : null}
    </div>
  )
}
