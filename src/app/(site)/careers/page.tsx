import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowUpRight,
  Briefcase,
  Clock3,
  Globe,
  Heart,
  MapPin,
  Plane,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Careers · Stayora",
  description:
    "Build the platform behind the world's most considered stays. Open roles across engineering, partnerships, design and guest experience at Stayora.",
}

const benefits: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Plane,
    title: "An annual stay credit",
    description:
      "Every employee gets a credit each year to stay at a Stayora property. You cannot recommend hotels you have never slept in.",
  },
  {
    icon: Globe,
    title: "Remote across 14 countries",
    description:
      "Work from where you are effective. We hire across Europe, the Middle East and Asia-Pacific, with hubs in London, Dubai and Singapore.",
  },
  {
    icon: Clock3,
    title: "Hours that respect the timezone",
    description:
      "Four fixed overlap hours a day, the rest is yours to structure. Meetings are recorded so nobody joins a call at midnight.",
  },
  {
    icon: TrendingUp,
    title: "Equity from day one",
    description:
      "Every permanent role carries equity, with a ten-year exercise window so leaving does not mean forfeiting what you built.",
  },
  {
    icon: Heart,
    title: "Health, properly covered",
    description:
      "Private medical, dental and optical for you and your dependants, plus a therapy allowance that does not require a diagnosis to use.",
  },
  {
    icon: Sparkles,
    title: "A learning budget you will actually spend",
    description:
      "An annual allowance for courses, conferences and books, and five working days set aside to use it.",
  },
]

const roles: {
  title: string
  team: string
  location: string
  type: string
}[] = [
  {
    title: "Senior Frontend Engineer",
    team: "Engineering",
    location: "Remote — Europe",
    type: "Full-time",
  },
  {
    title: "Backend Engineer, Payments",
    team: "Engineering",
    location: "London or Remote",
    type: "Full-time",
  },
  {
    title: "Product Designer",
    team: "Design",
    location: "Remote — Europe",
    type: "Full-time",
  },
  {
    title: "Hotel Partnerships Manager, GCC",
    team: "Partnerships",
    location: "Dubai",
    type: "Full-time",
  },
  {
    title: "Property Quality Assessor",
    team: "Curation",
    location: "Travelling — APAC",
    type: "Full-time",
  },
  {
    title: "Guest Experience Specialist (Night Desk)",
    team: "Guest Experience",
    location: "Singapore",
    type: "Full-time",
  },
  {
    title: "Revenue Analyst",
    team: "Commercial",
    location: "London",
    type: "Full-time",
  },
  {
    title: "Content Editor, Destinations",
    team: "Marketing",
    location: "Remote — Europe",
    type: "Contract",
  },
]

const process: { step: string; title: string; description: string }[] = [
  {
    step: "01",
    title: "Application",
    description:
      "A short form and your CV. No cover letter, no take-home before we have spoken to you.",
  },
  {
    step: "02",
    title: "Intro call",
    description:
      "Thirty minutes with the hiring manager to cover the role, the team and what you are looking for.",
  },
  {
    step: "03",
    title: "Craft interview",
    description:
      "A paid exercise or a working session on a real problem — your choice which. Never unpaid speculative work.",
  },
  {
    step: "04",
    title: "Team and offer",
    description:
      "Meet the people you would work with, then a decision within five working days either way.",
  },
]

export default function CareersPage() {
  return (
    <div>
      {/* HERO */}
      <section className="border-b bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
          <Badge variant="secondary" className="mx-auto">
            <Briefcase className="size-3" />
            Careers
          </Badge>
          <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Build the platform behind the world&apos;s best stays
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg text-pretty">
            We are a small, senior team spread across 14 countries, building a
            marketplace that people trust with the trip they have been saving
            for. If that sounds like your kind of problem, we would like to hear
            from you.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button render={<a href="#open-roles">See open roles</a>} />
            <Button
              variant="outline"
              render={<Link href="/about">About Stayora</Link>}
            />
          </div>
        </div>
      </section>

      {/* BENEFITS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            Why Stayora
          </h2>
          <p className="text-muted-foreground mt-2">
            The things we decided were worth paying for.
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

      {/* OPEN ROLES */}
      <section id="open-roles" className="scroll-mt-24 border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 className="font-heading text-3xl font-semibold tracking-tight">
                Open roles
              </h2>
              <p className="text-muted-foreground mt-2">
                {roles.length} positions open across engineering, design,
                partnerships and guest experience.
              </p>
            </div>
            <Badge variant="outline">Updated weekly</Badge>
          </div>

          <div className="mt-8 space-y-3">
            {roles.map((role) => (
              <Card key={role.title} className="group">
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="font-heading font-semibold">{role.title}</h3>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="flex items-center gap-1.5">
                        <Briefcase className="size-3.5" />
                        {role.team}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" />
                        {role.location}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock3 className="size-3.5" />
                        {role.type}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={
                      <a
                        href={`mailto:careers@stayora.com?subject=${encodeURIComponent(
                          `Application — ${role.title}`
                        )}`}
                      >
                        Apply
                        <ArrowUpRight className="size-4" />
                      </a>
                    }
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="text-muted-foreground mt-6 text-sm">
            Nothing that fits? Send your CV to{" "}
            <a
              href="mailto:careers@stayora.com"
              className="text-foreground hover:underline"
            >
              careers@stayora.com
            </a>{" "}
            and tell us what you would want to work on.
          </p>
        </div>
      </section>

      {/* PROCESS */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            How hiring works
          </h2>
          <p className="text-muted-foreground mt-2">
            Four steps, roughly three weeks, and a real answer at the end of it.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {process.map((stage) => (
            <Card key={stage.step}>
              <CardContent className="flex h-full flex-col gap-2">
                <span className="font-heading text-muted-foreground text-2xl font-semibold tabular-nums">
                  {stage.step}
                </span>
                <h3 className="font-heading font-semibold">{stage.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {stage.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
