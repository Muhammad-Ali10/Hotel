"use client"

import Link from "next/link"
import { AlertTriangle, MailWarning, Send } from "lucide-react"

import { useMailHealth } from "@/lib/admin/api/hooks"
import { Button } from "@/components/ui/button"

/* ============================================================================
 * Whether the platform is actually sending its email.
 *
 * Every way this fails is silent. A key that was never set, a sending domain
 * nobody verified, a provider refusing every message: the API stays up, the
 * screens stay green, and each notification is marked failed one at a time.
 * The first person to notice is a partner asking why they were never told
 * their property was approved.
 *
 * So this renders NOTHING when mail is healthy. A dashboard that carries a
 * permanent green "email: OK" panel trains everyone to stop reading it; a
 * banner that appears only when something is wrong is read every time.
 * ========================================================================== */

export function MailHealthBanner() {
  const health = useMailHealth()
  const data = health.data

  if (!data || data.status === "ok") return null

  const tone =
    data.status === "not_sending"
      ? {
          icon: MailWarning,
          className: "border-amber-500/40 bg-amber-500/5",
          iconClass: "text-amber-600 dark:text-amber-400",
        }
      : {
          icon: AlertTriangle,
          className: "border-destructive/40 bg-destructive/5",
          iconClass: "text-destructive",
        }

  const Icon = tone.icon

  return (
    <div className={`flex flex-wrap items-start gap-3 rounded-xl border p-4 ${tone.className}`}>
      <Icon className={`mt-0.5 size-5 shrink-0 ${tone.iconClass}`} />

      <div className="min-w-0 flex-1 space-y-1">
        {data.status === "not_sending" ? (
          <>
            <p className="text-sm font-semibold">No email is being delivered</p>
            <p className="text-muted-foreground text-sm">
              {/* Named exactly, because the fix is one environment variable and
                  the symptom is indistinguishable from everything working. */}
              The mail driver is <code className="font-mono">{data.driver}</code>, which
              accepts every message and sends none. Confirmations, verification
              links and payout notices are all being written and discarded. Set{" "}
              <code className="font-mono">MAIL_DRIVER=sendgrid</code> with a key to
              start delivering.
            </p>
          </>
        ) : data.status === "stuck" ? (
          <>
            <p className="text-sm font-semibold">
              {data.stuck} message{data.stuck === 1 ? "" : "s"} stuck in the outbox
            </p>
            <p className="text-muted-foreground text-sm">
              Due to be sent more than {data.stuckAfterMinutes} minutes ago and still
              waiting — the delivery job runs every minute, so something is stopping
              it. The oldest has been queued {data.oldestPendingMinutes} minutes.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold">Every message is failing</p>
            <p className="text-muted-foreground text-sm">
              {data.failedLastHour} failed in the last hour and none were sent.
              Usually the API key or the sending domain: {data.driver} rejects every
              message from <code className="font-mono">{data.from}</code> until that
              address is verified with the provider.
            </p>
          </>
        )}

        <p className="text-muted-foreground text-xs">
          {data.pending} waiting · {data.sentLastHour} sent in the last hour ·{" "}
          {data.failedLastHour} failed
        </p>
      </div>

      {data.status !== "not_sending" && (
        <Button
          size="sm"
          variant="outline"
          render={<Link href="/admin/settings">Platform settings</Link>}
        />
      )}
    </div>
  )
}

/**
 * The same thing as one line, for a settings page that should say what the
 * state is even when it is fine.
 */
export function MailHealthLine() {
  const health = useMailHealth()
  const data = health.data
  if (!data) return null

  const label =
    data.status === "ok"
      ? `Sending through ${data.driver} · ${data.sentLastHour} in the last hour`
      : data.status === "not_sending"
        ? `Not sending — driver is "${data.driver}"`
        : data.status === "stuck"
          ? `${data.stuck} stuck in the outbox`
          : `${data.failedLastHour} failed in the last hour`

  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <Send className="size-4 shrink-0" />
      {label}
    </p>
  )
}
