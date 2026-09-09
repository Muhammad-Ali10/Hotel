import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, Info } from "lucide-react"

import { PageHeader } from "@/components/extranet/shared"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = { title: "Taxes and charges" }

/**
 * Prices on Stayora are all-in (rule #11).
 *
 * This screen used to let a partner add tax lines and charge percentages on
 * top of a rate. Nothing downstream applied them: the quote engine has no tax
 * layer, the booking total has no tax field, and the invoice has no tax line.
 * A partner who set 15% VAT here would have seen it in the table and nowhere
 * else — not on a guest's confirmation, not on a payout, not on a return.
 *
 * So it says what is actually true instead. The honest version of a screen
 * whose feature does not exist is a sentence, not a form.
 */
export default function VatTaxPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Taxes and charges"
        subtitle="How tax works on the rates you set"
      >
        <Button variant="outline" size="sm" render={<Link href="/extranet/property" />}>
          <ChevronLeft className="size-4" />
          Back
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="space-y-4 py-6">
          <div className="flex gap-3">
            <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Info className="size-4" />
            </span>
            <div className="space-y-3">
              <h2 className="font-heading text-lg font-semibold">
                Your rates are the final price
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Stayora shows guests one number. The nightly rate you set is what a
                guest pays and what your payout is calculated from — there is no tax
                or service charge added on top at checkout.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                That means any VAT, city tax or service charge you are liable for
                should already be inside the rate. If local tax changes, change your
                rates — the calendar and the copy-rates tool are the fastest way to
                do that across a season.
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your commission is charged on that same final price, so nothing is
                calculated twice.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/extranet/rates/calendar">Open the rate calendar</Link>}
            />
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/extranet/finance/commissions">See how commission is charged</Link>}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
