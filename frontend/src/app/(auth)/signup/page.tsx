"use client"

import * as React from "react"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { signupSchema, type SignupInput } from "@stayora/shared"
import { authApi } from "@/lib/api/endpoints"
import { ApiError } from "@/lib/api/errors"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

/**
 * The API's schema, plus the one thing it has no column for.
 *
 * `agree` is a consent checkbox — the product needs it before an account is
 * made, the API has nowhere to put it, and inventing a field on the server for
 * something no endpoint reads would be worse than keeping it here.
 */
const formSchema = signupSchema.extend({
  agree: z.literal(true, {
    error: "Accept the terms and privacy policy to continue",
  }),
})

type SignupValues = z.input<typeof formSchema>

export default function SignupPage() {
  const router = useRouter()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues, unknown, z.output<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      agree: false as unknown as true,
    },
  })

  const [submitting, setSubmitting] = React.useState(false)

  /**
   * Creating an account (rule #58).
   *
   * The API answers the SAME WAY whether or not the address is already taken,
   * and deliberately returns no session — the truth goes to the mailbox. So
   * this cannot push to a dashboard the way it used to: there is nobody signed
   * in to show one to.
   */
  async function onSubmit(values: z.output<typeof formSchema>) {
    if (submitting) return
    setSubmitting(true)
    try {
      const { agree: _agree, ...account } = values
      void _agree
      await authApi.signup(account satisfies SignupInput)

      toast.success("Check your email", {
        description: "We've sent you a link to finish setting up your account.",
      })
      router.push("/login")
    } catch (error) {
      setSubmitting(false)
      toast.error("Could not create your account", {
        description:
          error instanceof ApiError ? error.message : "Check your details and try again.",
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Create your account</CardTitle>
        <p className="text-muted-foreground text-sm">
          Join Stayora and start booking unforgettable stays.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Two fields, not one.
              The API stores a first and last name, and splitting a single
              "Full name" on a space quietly mangles "Mary Jane Watson". */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                autoComplete="given-name"
                placeholder="Amelia"
                aria-invalid={!!errors.firstName}
                {...register("firstName")}
              />
              {errors.firstName ? (
                <p className="text-destructive text-sm">{errors.firstName.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                autoComplete="family-name"
                placeholder="Hart"
                aria-invalid={!!errors.lastName}
                {...register("lastName")}
              />
              {errors.lastName ? (
                <p className="text-destructive text-sm">{errors.lastName.message}</p>
              ) : null}
            </div>
          </div>
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
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              aria-describedby="password-hint"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            {errors.password ? (
              <p className="text-destructive text-sm">{errors.password.message}</p>
            ) : (
              <p id="password-hint" className="text-muted-foreground text-sm">
                At least 8 characters.
              </p>
            )}
          </div>
          <div>
            <label className="flex items-start gap-2 text-sm">
              <Controller
                control={control}
                name="agree"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value === true}
                    onCheckedChange={(v) => field.onChange(v === true)}
                    aria-invalid={!!errors.agree}
                    className="mt-0.5"
                  />
                )}
              />
              {/* Both documents exist, so link them rather than naming them. */}
              <span className="text-muted-foreground">
                I agree to the{" "}
                <Link href="/terms" className="text-foreground hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-foreground hover:underline">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {errors.agree ? (
              <p className="text-destructive mt-1.5 text-sm">{errors.agree.message}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating your account…
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
        <p className="text-muted-foreground mt-6 text-center text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground font-medium hover:underline">
            Login
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
