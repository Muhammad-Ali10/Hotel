"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.email("Enter a valid email address"),
  password: z.string().min(8, "Use at least 8 characters"),
  agree: z.literal(true, {
    error: "Accept the terms and privacy policy to continue",
  }),
})

type SignupValues = z.input<typeof signupSchema>

export default function SignupPage() {
  const router = useRouter()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    mode: "onBlur",
    defaultValues: {
      name: "",
      email: "",
      password: "",
      agree: false as unknown as true,
    },
  })

  function onSubmit() {
    toast.success("Account created", { description: "Welcome to Stayora." })
    router.push("/dashboard")
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
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              autoComplete="name"
              placeholder="John Doe"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
            {errors.name ? (
              <p className="text-destructive text-sm">{errors.name.message}</p>
            ) : null}
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
          <Button type="submit" className="w-full">
            Create Account
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
