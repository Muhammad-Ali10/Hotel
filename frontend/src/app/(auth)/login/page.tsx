import { Suspense } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "./_components/login-form"

/**
 * Sign in.
 *
 * The form reads `?next=` to send a guest back where they came from, and
 * `useSearchParams()` forces a client bailout that Next requires a Suspense
 * boundary for — without one the page cannot be prerendered at all, and the
 * build says so rather than shipping something that fails at runtime.
 *
 * The fallback is the same card with the fields greyed, so the page does not
 * jump when the form arrives.
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-2xl">Welcome back</CardTitle>
            <p className="text-muted-foreground text-sm">Sign in to continue to your account.</p>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4" aria-busy="true">
              <div className="h-9 w-full rounded bg-muted" />
              <div className="h-9 w-full rounded bg-muted" />
              <div className="h-9 w-full rounded bg-muted" />
            </div>
          </CardContent>
        </Card>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
