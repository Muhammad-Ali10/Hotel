import Link from "next/link"
import Image from "next/image"
import {
  ArrowRight,
  BadgeDollarSign,
  Gift,
  Headset,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import {
  destinations,
  luxuryCollection,
  specialOffers,
  testimonials,
  topRated,
  whyChooseUs,
} from "@/data"
import { avatarImage, destinationImage, hotelImage } from "@/lib/images"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { HeroSearch } from "@/components/marketplace/hero-search"
import { HotelCard } from "@/components/marketplace/hotel-card"
import { StarRating } from "@/components/marketplace/star-rating"

const featureIcons: Record<string, LucideIcon> = {
  BadgeDollarSign,
  ShieldCheck,
  Headset,
  Gift,
}

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

      {/* TOP RATED */}
      <Section
        title="Top Rated"
        subtitle="Handpicked properties with exceptional guest ratings"
        action={{ label: "View All", href: "/hotels" }}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {topRated.map((hotel) => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      </Section>

      {/* POPULAR DESTINATIONS */}
      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHead
            title="Popular Destinations"
            subtitle="Explore the world's most sought-after luxury destinations"
            action={{ label: "Explore All", href: "/hotels" }}
          />
          <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {destinations.map((d) => (
              <Link
                key={d.id}
                href={`/hotels?city=${encodeURIComponent(d.name)}`}
                className="group relative aspect-[4/5] overflow-hidden rounded-xl"
              >
                <Image
                  src={destinationImage(d.name, 400, 500)}
                  alt={d.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <div className="absolute bottom-0 p-4 text-white">
                  <p className="font-heading text-lg font-semibold">{d.name}</p>
                  <p className="text-sm text-white/80">{d.properties} properties</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* LUXURY COLLECTION */}
      <Section
        title="Luxury Collection"
        subtitle="Exclusive properties for the most discerning guests"
        action={{ label: "View Collection", href: "/hotels" }}
      >
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {luxuryCollection.map((hotel) => (
            <HotelCard key={hotel.id} hotel={hotel} />
          ))}
        </div>
      </Section>

      {/* SPECIAL OFFERS */}
      <section className="border-t">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHead
            title="Special Offers"
            subtitle="Limited-time deals on extraordinary properties"
            action={{ label: "All Deals", href: "/hotels" }}
          />
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {specialOffers.map((hotel) => (
              <HotelCard key={hotel.id} hotel={hotel} />
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              Why Choose Us
            </h2>
            <p className="text-muted-foreground mt-2">
              We curate only the finest properties and deliver unparalleled
              service to ensure every stay is extraordinary.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {whyChooseUs.map((f) => {
              const Icon = featureIcons[f.icon] ?? BadgeDollarSign
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

      {/* TESTIMONIALS */}
      <Section
        title="Guest Testimonials"
        subtitle="Hear from travelers who have experienced our curated luxury stays"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <Card key={t.id}>
              <CardContent className="space-y-4">
                <StarRating rating={t.rating} />
                <p className="text-pretty">“{t.quote}”</p>
                <div className="flex items-center gap-3 pt-2">
                  <Image
                    src={avatarImage(t.seed)}
                    alt={t.author}
                    width={44}
                    height={44}
                    className="size-11 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-medium">{t.author}</p>
                    <p className="text-muted-foreground text-sm">{t.role}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* NEWSLETTER */}
      <section className="border-t">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            Subscribe to Our Newsletter
          </h2>
          <p className="text-muted-foreground mt-2">
            Be the first to know about exclusive offers, new destinations, and
            luxury travel inspiration.
          </p>
          <form className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
            <Input type="email" placeholder="Enter your email address" required />
            <Button type="submit">Subscribe</Button>
          </form>
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
