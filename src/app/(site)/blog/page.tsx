import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { BookOpen, Clock3 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { destinationImage, hotelImage } from "@/lib/images"

export const metadata: Metadata = {
  title: "Journal · Stayora",
  description:
    "Destination guides, hotel openings and travel notes from the Stayora curation team — written by the people who assess the properties.",
}

type Article = {
  slug: string
  title: string
  excerpt: string
  category: string
  readingTime: string
  date: string
  image: string
}

const featured: Article = {
  slug: "what-makes-a-hotel-worth-the-journey",
  title: "What makes a hotel worth the journey",
  excerpt:
    "Our assessors stay in roughly forty properties a year and reject most of them. Here is the standard they are measuring against — and why a marble lobby has almost nothing to do with it.",
  category: "Curation",
  readingTime: "8 min read",
  date: "18 July 2026",
  image: hotelImage("journal-featured", 1200, 700),
}

const articles: Article[] = [
  {
    slug: "dubai-beyond-the-marina",
    title: "Dubai beyond the Marina",
    excerpt:
      "The creek-side neighbourhoods, the desert camps worth the drive, and the four hotels we send people to when they want the city rather than the postcard.",
    category: "Destinations",
    readingTime: "6 min read",
    date: "9 July 2026",
    image: destinationImage("Dubai", 600, 400),
  },
  {
    slug: "paris-in-the-off-season",
    title: "Paris in the off-season",
    excerpt:
      "February is the city's best-kept secret: half the queues, better tables, and rates that make the Left Bank suddenly reasonable.",
    category: "Destinations",
    readingTime: "5 min read",
    date: "1 July 2026",
    image: destinationImage("Paris", 600, 400),
  },
  {
    slug: "overwater-villas-what-to-ask",
    title: "Overwater villas: what to ask before you book",
    excerpt:
      "Lagoon depth, reef access, sunrise or sunset orientation. The five questions that separate a good Maldives booking from an expensive disappointment.",
    category: "Guides",
    readingTime: "7 min read",
    date: "24 June 2026",
    image: destinationImage("Maldives", 600, 400),
  },
  {
    slug: "ryokan-etiquette",
    title: "A first-timer's guide to ryokan etiquette",
    excerpt:
      "Onsen protocol, when to wear the yukata, and why dinner is served at the time it is served. Small things that make the stay considerably better.",
    category: "Guides",
    readingTime: "6 min read",
    date: "12 June 2026",
    image: destinationImage("Tokyo", 600, 400),
  },
  {
    slug: "openings-we-are-watching",
    title: "Six openings we are watching this year",
    excerpt:
      "A restored palazzo in Puglia, a cliff-edge lodge in Patagonia, and four more properties currently going through assessment.",
    category: "Openings",
    readingTime: "4 min read",
    date: "3 June 2026",
    image: hotelImage("journal-openings", 600, 400),
  },
  {
    slug: "reading-a-cancellation-policy",
    title: "How to actually read a cancellation policy",
    excerpt:
      "Free cancellation, partially refundable, non-refundable — what each really commits you to, and the timezone detail that catches people out.",
    category: "Guides",
    readingTime: "5 min read",
    date: "22 May 2026",
    image: hotelImage("journal-policy", 600, 400),
  },
]

const categories = ["All", "Destinations", "Guides", "Openings", "Curation"]

export default function BlogPage() {
  return (
    <div>
      {/* HERO */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
          <Badge variant="secondary" className="mx-auto">
            <BookOpen className="size-3" />
            The Journal
          </Badge>
          <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Notes from the road
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg text-pretty">
            Destination guides, hotel openings and honest travel advice —
            written by the assessors and specialists who visit the properties we
            list.
          </p>
        </div>
      </section>

      {/* FEATURED */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-80">
              <Image
                src={featured.image}
                alt={featured.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <CardContent className="flex flex-col justify-center gap-3 py-8">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Featured</Badge>
                <Badge variant="outline">{featured.category}</Badge>
              </div>
              <h2 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
                {featured.title}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {featured.excerpt}
              </p>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span>{featured.date}</span>
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-3.5" />
                  {featured.readingTime}
                </span>
              </div>
            </CardContent>
          </div>
        </Card>
      </section>

      {/* ARTICLES */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              Latest articles
            </h2>
            <p className="text-muted-foreground mt-1">
              New writing every fortnight.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge
                key={category}
                variant={category === "All" ? "default" : "outline"}
              >
                {category}
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <Card key={article.slug} className="group flex flex-col">
              <div className="relative aspect-[3/2] overflow-hidden">
                <Image
                  src={article.image}
                  alt={article.title}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <CardContent className="flex flex-1 flex-col gap-2">
                <Badge variant="outline" className="w-fit">
                  {article.category}
                </Badge>
                <h3 className="font-heading font-semibold text-balance">
                  {article.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {article.excerpt}
                </p>
                <div className="text-muted-foreground mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-xs">
                  <span>{article.date}</span>
                  <span className="flex items-center gap-1.5">
                    <Clock3 className="size-3" />
                    {article.readingTime}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            Get the Journal by email
          </h2>
          <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-sm">
            One edition a fortnight: new guides, properties we have just
            accepted, and rates worth knowing about. Unsubscribe whenever.
          </p>
          <form className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              placeholder="Enter your email address"
              aria-label="Email address"
              required
            />
            <Button type="submit">Subscribe</Button>
          </form>
          <p className="text-muted-foreground mx-auto mt-4 max-w-lg text-xs">
            By subscribing you agree to our{" "}
            <Link href="/privacy" className="hover:text-foreground underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  )
}
