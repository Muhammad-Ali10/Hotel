import type { Metadata } from "next"
import {
  ArrowUpRight,
  BookOpen,
  CalendarX2,
  CreditCard,
  Gift,
  HelpCircle,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserCircle,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FaqList } from "./_components/faq-list"
import { SupportSearch } from "./_components/support-search"
import { SupportTicketForm } from "./_components/support-ticket-form"
import { MyTickets } from "./_components/my-tickets"
import { HotelMessageForm } from "./_components/hotel-message-form"

export const metadata: Metadata = {
  title: "Help Center",
  description:
    "Find answers, browse help topics, and reach the Stayora support team — available around the clock for your luxury stays.",
}

const categories: {
  icon: LucideIcon
  title: string
  description: string
  articles: number
}[] = [
  {
    icon: BookOpen,
    title: "Booking & Reservations",
    description:
      "Search, compare and confirm stays, manage dates and guest details.",
    articles: 24,
  },
  {
    icon: CreditCard,
    title: "Payments & Billing",
    description:
      "Accepted methods, currencies, receipts, refunds and security.",
    articles: 18,
  },
  {
    icon: UserCircle,
    title: "Account & Profile",
    description:
      "Manage your profile, sign-in, preferences and saved travelers.",
    articles: 15,
  },
  {
    icon: CalendarX2,
    title: "Cancellations & Changes",
    description:
      "Modify or cancel a reservation and understand our policies.",
    articles: 12,
  },
  {
    icon: Gift,
    title: "Rewards & Loyalty",
    description:
      "Earn, track and redeem Stayora reward points on every stay.",
    articles: 9,
  },
  {
    icon: ShieldCheck,
    title: "Safety & Privacy",
    description:
      "How we protect your data, payments and personal information.",
    articles: 11,
  },
]

const contactMethods: {
  icon: LucideIcon
  title: string
  value: string
  note: string
  href: string
  badge: string
}[] = [
  {
    icon: Mail,
    title: "Email Support",
    value: "support@stayora.com",
    note: "Response within 24 hours",
    href: "mailto:support@stayora.com",
    badge: "Email",
  },
  {
    icon: Phone,
    title: "Phone Support",
    value: "+1 234 567 890",
    note: "Mon–Fri, 9AM – 8PM EST",
    href: "tel:+1234567890",
    badge: "Call",
  },
  {
    icon: MessageCircle,
    title: "Live Chat",
    value: "Chat with our team",
    note: "Available 24/7 for urgent issues",
    href: "#contact",
    badge: "24/7",
  },
]

export default function SupportPage() {
  return (
    <div className="stayora-support">
      {/* HERO */}
      <section
        id="about"
        className="scroll-mt-24 border-b bg-muted/30"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
          <Badge variant="secondary" className="mx-auto">
            <HelpCircle className="size-3" />
            Help Center
          </Badge>
          <h1 className="font-heading mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            How can we help?
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg text-pretty">
            Search our help articles, browse popular topics, or reach the
            Stayora support team directly. We&apos;re here around the clock for
            your luxury stays.
          </p>
          <div className="mx-auto mt-8 max-w-xl">
            <SupportSearch />
          </div>
        </div>
      </section>

      {/* HELP CATEGORIES */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            Browse help topics
          </h2>
          <p className="text-muted-foreground mt-2">
            Choose a category to find step-by-step guides and answers.
          </p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => {
            const Icon = cat.icon
            return (
              <Card
                key={cat.title}
                className="group transition-shadow hover:ring-foreground/20"
              >
                <CardContent className="flex h-full flex-col gap-3">
                  <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-xl">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="font-heading font-semibold">{cat.title}</h3>
                  <p className="text-muted-foreground text-sm">
                    {cat.description}
                  </p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <span className="text-muted-foreground text-xs">
                      {cat.articles} articles
                    </span>
                    <ArrowUpRight className="text-muted-foreground size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* CONTACT US */}
      <section id="contact" className="scroll-mt-24 border-y bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-heading text-3xl font-semibold tracking-tight">
              Contact Us
            </h2>
            <p className="text-muted-foreground mt-2">
              Reach our support team directly through any of the channels below.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {contactMethods.map((method) => {
              const Icon = method.icon
              return (
                <Card key={method.title} className="group">
                  <CardContent className="flex items-start gap-4">
                    <span className="bg-primary text-primary-foreground flex size-11 shrink-0 items-center justify-center rounded-xl">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-semibold">
                          {method.title}
                        </h3>
                        <Badge variant="secondary">{method.badge}</Badge>
                      </div>
                      <a
                        href={method.href}
                        className="mt-1 block truncate text-sm font-medium hover:underline"
                      >
                        {method.value}
                      </a>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {method.note}
                      </p>
                    </div>
                    <ArrowUpRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* TWO FORMS */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Submit a Support Ticket
                </CardTitle>
                <CardDescription>
                  Our team will respond within 24 hours.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SupportTicketForm />
              </CardContent>
            </Card>

            {/* Submitted tickets — the form had nowhere to submit to before */}
            <div className="space-y-3">
              <h2 className="font-heading text-lg font-semibold">My Tickets</h2>
              <MyTickets />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-lg">
                  Message a Hotel
                </CardTitle>
                <CardDescription>
                  Contact a property directly about your stay.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <HotelMessageForm />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ — `#faq` is where the search box scrolls to. */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground mt-2">
            Quick answers to common questions.
          </p>
        </div>
        <FaqList />

        <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border bg-muted/30 p-8 text-center">
          <MapPin className="text-muted-foreground size-6" />
          <h3 className="font-heading font-semibold">Still need help?</h3>
          <p className="text-muted-foreground max-w-md text-sm">
            Our concierge support team is ready to assist with anything not
            covered above.
          </p>
          <Button
            render={<a href="#contact">Contact support</a>}
            className="mt-1"
          />
        </div>
      </section>
    </div>
  )
}
