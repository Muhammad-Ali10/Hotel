"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ClipboardCheck,
  CreditCard,
  Lock,
  MapPin,
  ShieldCheck,
  User,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import type { Hotel } from "@/types"
import { formatCurrency, formatDate } from "@/lib/format"
import { hotelImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"

const TAX_RATE = 0.12

const steps = [
  { n: 1, label: "Your Details", icon: User },
  { n: 2, label: "Payment", icon: CreditCard },
  { n: 3, label: "Review", icon: ClipboardCheck },
]

export function CheckoutFlow({
  hotel,
  roomId,
  checkIn,
  checkOut,
  guests,
}: {
  hotel: Hotel
  roomId: string
  checkIn: string
  checkOut: string
  guests: string
}) {
  const router = useRouter()
  const [step, setStep] = React.useState(1)
  const [form, setForm] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    country: "United States",
    specialRequests: "",
    payMethod: "card",
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    agree: false,
  })
  const set = (patch: Partial<typeof form>) =>
    setForm((f) => ({ ...f, ...patch }))

  const room = hotel.rooms.find((r) => r.id === roomId) ?? hotel.rooms[0]
  const [g, r] = guests.split("-")
  const guestsLabel = `${g} ${Number(g) === 1 ? "Guest" : "Guests"}, ${r} ${Number(r) === 1 ? "Room" : "Rooms"}`

  const nights = React.useMemo(() => {
    const diff =
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000
    return Number.isFinite(diff) && diff > 0 ? Math.round(diff) : 1
  }, [checkIn, checkOut])

  const subtotal = room.pricePerNight * nights
  const taxes = Math.round(subtotal * TAX_RATE)
  const total = subtotal + taxes
  const nightLabel = nights === 1 ? "night" : "nights"

  function validate(current: number) {
    if (current === 1) {
      if (!form.firstName || !form.lastName || !/\S+@\S+\.\S+/.test(form.email)) {
        toast.error("Please enter your name and a valid email.")
        return false
      }
    }
    if (current === 2 && form.payMethod === "card") {
      if (!form.cardName || !form.cardNumber || !form.cardExpiry || !form.cardCvv) {
        toast.error("Please complete your card details.")
        return false
      }
    }
    return true
  }

  function next() {
    if (!validate(step)) return
    setStep((s) => Math.min(3, s + 1))
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function back() {
    setStep((s) => Math.max(1, s - 1))
  }

  function confirm() {
    if (!form.agree) {
      toast.error("Please accept the terms & conditions to continue.")
      return
    }
    const ref = "STY-" + Math.random().toString(36).slice(2, 8).toUpperCase()
    const params = new URLSearchParams({
      hotel: hotel.id,
      room: room.id,
      checkin: checkIn,
      checkout: checkOut,
      guests,
      ref,
      name: form.firstName,
      email: form.email,
      pay: form.payMethod,
    })
    router.push(`/checkout/confirmation?${params.toString()}`)
  }

  return (
    <div>
      {/* STEPPER */}
      <ol className="flex items-center">
        {steps.map((s, i) => (
          <li
            key={s.n}
            className={cn("flex items-center", i < steps.length - 1 && "flex-1")}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  step >= s.n
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step > s.n ? <Check className="size-4" /> : s.n}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:block",
                  step >= s.n ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "mx-3 h-px flex-1",
                  step > s.n ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* LEFT — step content */}
        <div className="min-w-0">
          {step === 1 ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-heading text-xl font-semibold">
                  Guest Details
                </h2>
                <p className="text-muted-foreground text-sm">
                  Who is this booking for?
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="firstName">
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => set({ firstName: e.target.value })}
                    placeholder="John"
                  />
                </Field>
                <Field label="Last name" htmlFor="lastName">
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => set({ lastName: e.target.value })}
                    placeholder="Doe"
                  />
                </Field>
                <Field label="Email" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set({ email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </Field>
                <Field label="Phone" htmlFor="phone">
                  <Input
                    id="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set({ phone: e.target.value })}
                    placeholder="+1 555 000 1234"
                  />
                </Field>
                <Field label="Country / Region" htmlFor="country">
                  <Input
                    id="country"
                    value={form.country}
                    onChange={(e) => set({ country: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Special requests (optional)" htmlFor="requests">
                <Textarea
                  id="requests"
                  value={form.specialRequests}
                  onChange={(e) => set({ specialRequests: e.target.value })}
                  placeholder="Early check-in, high floor, airport transfer…"
                  rows={3}
                />
              </Field>
            </section>
          ) : null}

          {step === 2 ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-heading text-xl font-semibold">Payment</h2>
                <p className="text-muted-foreground text-sm">
                  Choose how you&apos;d like to pay.
                </p>
              </div>

              <RadioGroup
                value={form.payMethod}
                onValueChange={(v) => set({ payMethod: v as string })}
                className="gap-3"
              >
                <PayOption
                  value="card"
                  active={form.payMethod === "card"}
                  icon={<CreditCard className="size-4" />}
                  title="Credit / Debit Card"
                  desc="Pay securely now"
                />
                <PayOption
                  value="property"
                  active={form.payMethod === "property"}
                  icon={<Building2 className="size-4" />}
                  title="Pay at Property"
                  desc="No prepayment needed"
                />
              </RadioGroup>

              {form.payMethod === "card" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Field label="Name on card" htmlFor="cardName">
                      <Input
                        id="cardName"
                        value={form.cardName}
                        onChange={(e) => set({ cardName: e.target.value })}
                        placeholder="John Doe"
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Card number" htmlFor="cardNumber">
                      <div className="relative">
                        <CreditCard className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                        <Input
                          id="cardNumber"
                          inputMode="numeric"
                          value={form.cardNumber}
                          onChange={(e) => set({ cardNumber: e.target.value })}
                          placeholder="1234 5678 9012 3456"
                          className="pl-8"
                        />
                      </div>
                    </Field>
                  </div>
                  <Field label="Expiry" htmlFor="cardExpiry">
                    <Input
                      id="cardExpiry"
                      value={form.cardExpiry}
                      onChange={(e) => set({ cardExpiry: e.target.value })}
                      placeholder="MM / YY"
                    />
                  </Field>
                  <Field label="CVV" htmlFor="cardCvv">
                    <Input
                      id="cardCvv"
                      inputMode="numeric"
                      value={form.cardCvv}
                      onChange={(e) => set({ cardCvv: e.target.value })}
                      placeholder="123"
                    />
                  </Field>
                </div>
              ) : (
                <div className="text-muted-foreground bg-muted/40 flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-sm">
                  <Building2 className="mt-0.5 size-4 shrink-0" />
                  You&apos;ll pay the full amount at the property during your stay.
                  A valid card may be required to guarantee the booking.
                </div>
              )}

              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Lock className="size-3.5" />
                Your payment information is encrypted and secure.
              </div>
            </section>
          ) : null}

          {step === 3 ? (
            <section className="space-y-5">
              <div>
                <h2 className="font-heading text-xl font-semibold">
                  Review &amp; Confirm
                </h2>
                <p className="text-muted-foreground text-sm">
                  Please review your booking before confirming.
                </p>
              </div>

              <Card>
                <CardContent className="space-y-4">
                  <ReviewRow label="Lead guest">
                    {form.firstName || form.lastName
                      ? `${form.firstName} ${form.lastName}`.trim()
                      : "—"}
                  </ReviewRow>
                  <ReviewRow label="Contact">
                    {form.email || "—"}
                    {form.phone ? ` · ${form.phone}` : ""}
                  </ReviewRow>
                  <Separator />
                  <ReviewRow label="Stay">
                    {formatDate(checkIn)} → {formatDate(checkOut)} · {nights}{" "}
                    {nightLabel}
                  </ReviewRow>
                  <ReviewRow label="Room">{room.name}</ReviewRow>
                  <ReviewRow label="Guests">{guestsLabel}</ReviewRow>
                  <ReviewRow label="Payment">
                    {form.payMethod === "card" ? "Credit / Debit Card" : "Pay at Property"}
                  </ReviewRow>
                  {form.specialRequests ? (
                    <ReviewRow label="Requests">{form.specialRequests}</ReviewRow>
                  ) : null}
                </CardContent>
              </Card>

              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <Checkbox
                  checked={form.agree}
                  onCheckedChange={(v) => set({ agree: v === true })}
                  className="mt-0.5"
                />
                <span className="text-muted-foreground">
                  I agree to the{" "}
                  <span className="text-foreground font-medium underline">
                    Terms &amp; Conditions
                  </span>{" "}
                  and{" "}
                  <span className="text-foreground font-medium underline">
                    Cancellation Policy
                  </span>
                  .
                </span>
              </label>
            </section>
          ) : null}

          {/* NAV */}
          <div className="mt-8 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button variant="outline" onClick={back}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <Button onClick={next}>
                Continue
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={confirm}>
                <ShieldCheck className="size-4" />
                Confirm Booking · {formatCurrency(total)}
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT — booking summary */}
        <div className="min-w-0">
          <Card className="lg:sticky lg:top-24">
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="bg-muted relative size-16 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={hotelImage(hotel.seed, 160, 160)}
                    alt={hotel.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading truncate font-semibold">
                    {hotel.name}
                  </h3>
                  <p className="text-muted-foreground flex items-center gap-1 text-sm">
                    <MapPin className="size-3.5" />
                    {hotel.city}, {hotel.country}
                  </p>
                  <Badge variant="secondary" className="mt-1">
                    {hotel.type}
                  </Badge>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    Dates
                  </span>
                  <span className="font-medium">
                    {formatDate(checkIn)} → {formatDate(checkOut)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    Guests
                  </span>
                  <span className="font-medium">{guestsLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Room</span>
                  <span className="font-medium">{room.name}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {formatCurrency(room.pricePerNight)} × {nights} {nightLabel}
                  </span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Taxes &amp; fees</span>
                  <span className="font-medium">{formatCurrency(taxes)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-base">
                  <span className="font-heading font-semibold">Total</span>
                  <span className="font-heading font-semibold">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <div className="text-muted-foreground flex items-start gap-2 text-sm">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>
                  <span className="text-foreground font-medium">
                    Free Cancellation
                  </span>
                  <span className="block text-xs">
                    Up to 24 hours before check-in
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function PayOption({
  value,
  active,
  icon,
  title,
  desc,
}: {
  value: string
  active: boolean
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors",
        active ? "border-primary bg-primary/5" : "hover:bg-accent/50"
      )}
    >
      <RadioGroupItem value={value} />
      <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-full">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-muted-foreground block text-xs">{desc}</span>
      </span>
    </label>
  )
}

function ReviewRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}
