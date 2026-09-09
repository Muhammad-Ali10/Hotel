import Link from "next/link"
import {
  ArrowUpRight,
  Headset,
  Mail,
  MessageCircle,
  Phone,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { SupportForms } from "./_components/support-forms"

export default function DashboardSupportPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Help &amp; Support
        </h1>
        <p className="text-muted-foreground mt-1">
          Reach our support team or message a hotel directly about your stay.
        </p>
      </header>

      {/* CONTACT US */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
            <Headset className="size-5" />
          </span>
          <div>
            <h2 className="font-heading text-lg font-semibold">Contact Us</h2>
            <p className="text-muted-foreground text-sm">
              Reach our support team directly
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ContactCard
            icon={<Mail className="size-5" />}
            title="Email Support"
            value="support@stayora.com"
            hint="Response within 24 hours"
            href="mailto:support@stayora.com"
          />
          <ContactCard
            icon={<Phone className="size-5" />}
            title="Phone Support"
            value="+1 234 567 890"
            hint="Mon–Fri, 9AM – 8PM EST"
            href="tel:+1234567890"
          />
        </div>

        <ContactCard
          icon={<MessageCircle className="size-5" />}
          title="Live Chat"
          value="Chat with our team"
          hint="Available 24/7 for urgent issues"
          online
        />
      </section>

      {/* FORMS */}
      <SupportForms />
    </div>
  )
}

function ContactCard({
  icon,
  title,
  value,
  hint,
  href,
  online,
}: {
  icon: React.ReactNode
  title: string
  value: string
  hint: string
  href?: string
  online?: boolean
}) {
  const inner = (
    <CardContent className="flex items-center gap-4">
      <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="truncate text-sm">{value}</p>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
      {online ? (
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
          <span className="size-2 rounded-full bg-emerald-500" />
          Online
        </span>
      ) : (
        <ArrowUpRight className="text-muted-foreground size-4 shrink-0" />
      )}
    </CardContent>
  )

  return (
    <Card className={cn("transition-colors", href && "hover:border-primary/40")}>
      {href ? (
        <Link href={href} className="block">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </Card>
  )
}
