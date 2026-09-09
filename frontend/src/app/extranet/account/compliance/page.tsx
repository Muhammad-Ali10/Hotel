import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { Icon, PageHeader, SectionCard } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

/**
 * The PLATFORM's compliance posture, not the property's.
 *
 * This screen used to show per-property "regulatory status" — tourist tax
 * registration, fire certificates, local licences — with pass/fail badges
 * nothing produced. That is not a status Stayora is in any position to assert:
 * nobody uploads a fire certificate here, nothing verifies one, and printing
 * "Compliant ✓" beside a property whose licence expired last year is worse
 * than saying nothing at all.
 *
 * What IS true is how the platform handles data and money on a partner's
 * behalf, which is what a partner's own auditor asks about. That is static
 * because it is a statement about the product, not a per-account measurement —
 * and static text is exactly right for it.
 */

const POSTURE = [
  {
    icon: "CreditCard",
    title: "Card details never touch our servers",
    body: "Payments are tokenised by the payment provider. Stayora stores a token and the last four digits — never a full card number, and never a CVV. That keeps card handling inside the provider's PCI scope rather than yours or ours.",
  },
  {
    icon: "Lock",
    title: "Guest data is scoped to who needs it",
    body: "You see the guests who booked your properties, and only while there is a reason to. A staff member sees bookings and messages; prices, payouts and the team are closed to them. Every request is checked against the account making it, not against what the screen happened to send.",
  },
  {
    icon: "FileText",
    title: "Records that cannot be quietly rewritten",
    body: "A signed agreement, a commission invoice and a settled payout are records. Nothing in the product edits them after the fact: a correction is a new row that explains itself, so the history stays readable when somebody asks about it a year later.",
  },
  {
    icon: "Mail",
    title: "Marketing is opt-in, everything else is not a choice",
    body: "Offers are off until a guest asks for them. A booking confirmation or a refund notice is a record of something that happened to somebody's money, so it is always sent — there is no switch for it, because a switch implying otherwise would be a promise the law does not allow us to keep.",
  },
  {
    icon: "Trash2",
    title: "Deletion, where deletion is possible",
    body: "A guest may close their account. Bookings, invoices and payouts survive it in a form that no longer names them, because tax and accounting obligations outlive a person's wish to be forgotten — and a marketplace that deletes last year's invoices cannot file its returns.",
  },
]

export default function CompliancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        subtitle="How Stayora handles data and money on your behalf"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/account" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <div className="grid gap-6 sm:grid-cols-2">
        {POSTURE.map((item) => (
          <Card key={item.title}>
            <CardContent className="space-y-3">
              <span className="bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg">
                <Icon name={item.icon} className="size-4" />
              </span>
              <div className="space-y-1">
                <h3 className="font-heading text-sm font-semibold">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {item.body}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <SectionCard
        title="What this page does not cover"
        description="Your own obligations as a property."
      >
        <p className="text-muted-foreground text-sm leading-relaxed">
          Tourist tax registration, local licensing, fire and safety certification and
          employment law are yours, and Stayora holds no evidence of any of them. A
          previous version of this screen showed pass marks against exactly those
          things; nothing in the product could have known, so the marks meant nothing.
          If you need a compliance statement for an auditor, your contracts are under{" "}
          <Link href="/extranet/account/contracts" className="text-foreground underline">
            Contracts
          </Link>
          .
        </p>
      </SectionCard>
    </div>
  )
}
