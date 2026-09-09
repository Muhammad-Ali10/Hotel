"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import type { z } from "zod"

import { loginSchema, type LoginInput , type SessionUser } from "@stayora/shared"
import { useLogin } from "@/lib/api/hooks"
import { ApiError } from "@/lib/api/errors"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

/**
 * Sign in.
 *
 * The form validates with the API's OWN schema (`loginSchema` from
 * `@stayora/shared`) rather than a local copy. A second copy is how a field
 * the server requires goes missing from the form — `remember` was exactly
 * that, and only the shared type caught it.
 *
 * Until this was wired the page fired a toast and pushed to `/dashboard`
 * without signing anybody in. Every screen behind it then had no session.
 */
/**
 * Where an account belongs when it has not asked for anywhere in particular.
 *
 * Everybody used to land on `/dashboard`. For a partner that is the GUEST
 * dashboard — their own empty bookings and favourites, with nothing on it
 * suggesting the extranet exists, which is where their property, their rates
 * and their money are. An administrator got the same.
 *
 * `?next=` still wins: somebody sent here from checkout goes back to checkout,
 * whatever they are.
 */
function homeFor(role: SessionUser["role"]): string {
  if (role === "partner") return "/extranet"
  if (role === "admin") return "/admin"
  return "/dashboard"
}

export function LoginForm() {
  const router = useRouter()
  const search = useSearchParams()
  const login = useLogin()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    /*
     * Three generics, not one.
     *
     * `remember` carries a `.default()`, so the schema's INPUT type has it
     * optional and its OUTPUT type has it required. `useForm<LoginInput>`
     * asks the form to hold the output shape, which the resolver cannot
     * produce from an empty form. The transformed type is what `onSubmit`
     * receives — the one the API actually takes.
     */
  } = useForm<z.input<typeof loginSchema>, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onBlur",
    defaultValues: { email: "", password: "", remember: false },
  })

  async function onSubmit(values: LoginInput) {
    try {
      const { user } = await login.mutateAsync(values)
      toast.success("Signed in", { description: `Welcome back, ${user.firstName}.` })

      /*
       * Back where they were headed.
       *
       * A guest sent here from checkout should land back in checkout, not on a
       * dashboard — losing their dates and their room because they had to sign
       * in is how a booking gets abandoned. `next` is checked to be a relative
       * path: an absolute one would make this an open redirect.
       */
      const next = search.get("next")
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null
      router.push(safeNext ?? homeFor(user.role))
    } catch (error) {
      /*
       * One message for a wrong password and an address that does not exist.
       * Telling them apart is how a login form becomes a way to find out who
       * has an account (rule #58's whole point).
       */
      toast.error("Could not sign in", {
        description:
          error instanceof ApiError ? error.message : "Check your details and try again.",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Welcome back</CardTitle>
        <p className="text-muted-foreground text-sm">
          Sign in to continue to your account.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email ? (
              <p className="text-destructive text-sm">{errors.email.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {/* There is no reset flow yet, so this points at the people who
                  can actually help rather than at "#". */}
              <Link
                href="/support#contact"
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-destructive text-sm">{errors.password.message}</p>
            ) : null}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Controller
              control={control}
              name="remember"
              render={({ field }) => (
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                />
              )}
            />
            Remember me
          </label>
          <Button type="submit" className="w-full" disabled={login.isPending}>
            {login.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
        <p className="text-muted-foreground mt-6 text-center text-sm">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-foreground font-medium hover:underline">
            Register
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
