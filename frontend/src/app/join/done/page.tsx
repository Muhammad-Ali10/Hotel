"use client"

import Link from "next/link"
import { CircleCheck, Clock, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate } from "@/lib/format"

import { WizardShell } from "../_components/wizard-shell"
import { SummaryList } from "../_components/summary"
import { useWizard } from "../_components/wizard-provider"
import { propertyTypeLabels, money } from "../_lib/labels"

/* ============================================================================
 * Where an application stands.
 *
 * It used to say one thing regardless: "You're all set! Your property has been
 * successfully registered... your listing will be reviewed and go live within
 * 24–48 hours", with a button to the extranet.
 *
 * Three problems. Nothing had been registered — this screen was reached by a
 * router push, not by a submission. There is no 24–48 hour service level
 * anywhere in this platform; a reviewer decides when they decide. And the
 * extranet is closed to the applicant until approval promotes them to a
 * partner, so the one button on the screen led to a locked door.
 *
 * It now reads the real status. A rejected application says so, with the
 * reviewer's reason, because a partner who is never told is a support ticket.
 * ========================================================================== */

export default function DonePage() {
  const { data, view, photos } = useWizard()

  const status = view?.status ?? "in_progress"
  const location = [data.city, data.country].filter(Boolean).join(", ")

  const heading =
    status === "approved"
      ? { icon: CircleCheck, tone: "green", title: "You're live" }
      : status === "rejected"
        ? { icon: XCircle, tone: "red", title: "Not approved" }
        : status === "submitted"
          ? { icon: Clock, tone: "amber", title: "With the platform" }
          : { icon: Clock, tone: "amber", title: "Not sent yet" }

  const Icon = heading.icon

  return (
    <WizardShell>
      <Card>
        <CardContent className="px-6 py-8">
          <div className="flex flex-col items-center text-center">
            <span
              className={
                "flex size-14 items-center justify-center rounded-full " +
                (heading.tone === "green"
                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                  : heading.tone === "red"
                    ? "bg-destructive/10 text-destructive"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400")
              }
            >
              <Icon className="size-8" />
            </span>
            <h1 className="font-heading mt-4 text-2xl font-semibold tracking-tight">
              {heading.title}
            </h1>

            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-relaxed">
              {status === "approved" ? (
                <>
                  Your property is on the marketplace and open for bookings.
                  Everything from here — rates, availability, guests — is in the
                  extranet.
                </>
              ) : status === "rejected" ? (
                <>
                  The platform could not approve this application.
                  {view?.decisionNote ? "" : " Partner support can tell you more."}
                </>
              ) : status === "submitted" ? (
                <>
                  {/* No invented SLA. Somebody reads it; how long that takes is
                      not something this screen knows. */}
                  A reviewer has your application. We&apos;ll email you at{" "}
                  <span className="text-foreground font-medium">
                    {view ? "your account address" : "your email"}
                  </span>{" "}
                  as soon as there is a decision — there is nothing else for you
                  to do.
                  {view?.submittedAt
                    ? ` Sent ${formatDate(view.submittedAt)}.`
                    : ""}
                </>
              ) : (
                <>
                  Your application has not been sent yet. Finish the last screen
                  and it goes to the platform for review.
                </>
              )}
            </p>

            {status === "rejected" && view?.decisionNote && (
              <p className="bg-muted/40 mt-4 w-full rounded-lg border p-3 text-left text-sm">
                <span className="font-medium">Reason: </span>
                {view.decisionNote}
              </p>
            )}
          </div>

          <div className="bg-muted/40 mt-6 rounded-xl border p-4">
            <p className="mb-1 text-sm font-semibold">Application summary</p>
            <SummaryList
              rows={[
                { label: "Property", value: data.propertyName || "—" },
                {
                  label: "Type",
                  value: data.propertyType ? propertyTypeLabels[data.propertyType] : "—",
                },
                { label: "Location", value: location || "—" },
                { label: "Rooms", value: data.units.length },
                { label: "Photos", value: photos.length },
                {
                  label: "From",
                  value: data.baseRate ? money(data.baseRate) : "—",
                },
              ]}
            />
          </div>

          {/* The extranet is closed until approval promotes the account to a
              partner, so it is only offered once that has happened. */}
          {status === "approved" ? (
            <Button
              className="mt-6 w-full"
              render={<Link href="/extranet">Go to the extranet</Link>}
            />
          ) : status === "rejected" ? (
            <Button
              className="mt-6 w-full"
              variant="outline"
              render={<Link href="/support">Contact partner support</Link>}
            />
          ) : status === "submitted" ? (
            <Button
              className="mt-6 w-full"
              variant="outline"
              render={<Link href="/">Back to Stayora</Link>}
            />
          ) : (
            <Button className="mt-6 w-full" render={<Link href="/join/complete">Finish and send</Link>} />
          )}
        </CardContent>
      </Card>
    </WizardShell>
  )
}
