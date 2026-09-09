"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Loader2, MailWarning } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import { useResendVerification, useSession, useVerifyEmail } from "@/lib/api/hooks"

/**
 * Where the verification email lands.
 *
 * Every `verify_email` notification links here with a token — and until now
 * this route did not exist, so the one link the platform sends to prove an
 * address returned a 404. Nobody's address could be verified through the
 * product at all.
 *
 * The token is spent on arrival rather than behind a button: the person has
 * already acted, by clicking the link in their mail. A second confirmation
 * step here would only be a chance to get it wrong.
 */
function VerifyEmailInner() {
  const params = useSearchParams()
  const token = params.get("token")?.trim() ?? ""

  const verify = useVerifyEmail()
  const resend = useResendVerification()
  const session = useSession()

  /*
   * Once per token. `useEffect` with the token as its only dependency, and a
   * ref for the mutation, because React runs effects twice in development —
   * and the second run would spend a token the first had already consumed,
   * turning a good link into "no longer valid".
   */
  const fired = React.useRef("")
  const mutate = verify.mutate
  React.useEffect(() => {
    if (!token || fired.current === token) return
    fired.current = token
    mutate(token)
  }, [token, mutate])

  if (!token) {
    return (
      <Outcome
        icon={<MailWarning className="size-6" />}
        title="That link is incomplete"
        body="Open the link straight from the email — some mail clients cut long links in half."
      >
        {session.data ? <ResendButton resend={resend} /> : null}
      </Outcome>
    )
  }

  if (verify.isPending || verify.isIdle) {
    return (
      <Outcome
        icon={<Loader2 className="size-6 animate-spin" />}
        title="Confirming your email…"
        body="This only takes a moment."
      />
    )
  }

  if (verify.isError) {
    return (
      <Outcome
        icon={<MailWarning className="text-destructive size-6" />}
        title="That link is no longer valid"
        body={
          verify.error?.message ??
          "Verification links expire, and each one can only be used once."
        }
      >
        {session.data ? (
          <ResendButton resend={resend} />
        ) : (
          <Button className="w-full" render={<Link href="/login">Sign in to send a new one</Link>} />
        )}
      </Outcome>
    )
  }

  return (
    <Outcome
      icon={<CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />}
      title="Email confirmed"
      body="Thanks — your address is verified. You can carry on where you left off."
    >
      <div className="grid gap-2">
        <Button className="w-full" render={<Link href="/dashboard">Go to your dashboard</Link>} />
        <Button
          variant="outline"
          className="w-full"
          render={<Link href="/join/verify">Back to your application</Link>}
        />
      </div>
    </Outcome>
  )
}

function ResendButton({ resend }: { resend: ReturnType<typeof useResendVerification> }) {
  return (
    <Button
      className="w-full"
      onClick={() => resend.mutate()}
      disabled={resend.isPending || resend.isSuccess}
    >
      {resend.isPending && <Loader2 className="size-4 animate-spin" />}
      {resend.isSuccess ? "Sent — check your inbox" : "Send a new link"}
    </Button>
  )
}

function Outcome({
  icon,
  title,
  body,
  children,
}: {
  icon: React.ReactNode
  title: string
  body: string
  children?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-6 text-center">
        <div className="bg-muted mx-auto flex size-12 items-center justify-center rounded-full">
          {icon}
        </div>
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{body}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

/**
 * `useSearchParams` needs a Suspense boundary above it, or the whole route
 * opts out of static rendering.
 */
export default function VerifyEmailPage() {
  return (
    <React.Suspense
      fallback={
        <Outcome
          icon={<Loader2 className="size-6 animate-spin" />}
          title="Confirming your email…"
          body="This only takes a moment."
        />
      }
    >
      <VerifyEmailInner />
    </React.Suspense>
  )
}
