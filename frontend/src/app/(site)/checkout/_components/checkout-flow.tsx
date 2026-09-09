"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, useWatch, Controller, type FieldPath } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  Gift,
  Lock,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react"
import { toast } from "sonner"

import { ApiError } from "@/lib/api/errors"
import type { Quote } from "@/lib/api/endpoints"

import type { BookingAddOn, Hotel, Room } from "@/types"
import { valueAddUnitLabel } from "@/lib/labels"
import { formatCurrency, formatDate } from "@/lib/format"
import {
  formatTime24,
} from "@/lib/domain"
import { hotelImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { useProperty, useQuote, useSession, useCreateBooking, useStartPayment } from "@/lib/api/hooks"
import { toHotel } from "@/lib/api/adapt"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NotFoundCard } from "@/components/shared/not-found-card"

const steps = [
  { n: 1, label: "Your Details", icon: User },
  { n: 2, label: "Extras", icon: Gift },
  { n: 3, label: "Payment", icon: CreditCard },
  { n: 4, label: "Review", icon: ClipboardCheck },
]

/**
 * Arrival windows, from THIS property's check-in time.
 *
 * They used to be a fixed list starting at 15:00 for every hotel in the
 * catalogue. A property that opens at 14:00 was missing its first hour, and
 * one that opens at 16:00 offered a window before anybody could get in — the
 * label above the field even printed the real check-in time beside the wrong
 * options.
 *
 * Six hourly windows, then "later" and "not sure yet". The last two matter:
 * a guest arriving at midnight and a guest who genuinely does not know are
 * different things to a front desk, and neither is a time.
 */
function arrivalWindows(checkInTime: string) {
  const [hourText] = checkInTime.split(":")
  const start = Number(hourText)

  // An unparseable time is not worth guessing around; offer only the two
  // answers that do not depend on knowing when the property opens.
  if (!Number.isInteger(start)) {
    return [
      { value: "later", label: "Later in the evening" },
      { value: "unsure", label: "I am not sure yet" },
    ]
  }

  const pad = (n: number) => String(n % 24).padStart(2, "0")

  const windows = Array.from({ length: 6 }, (_, i) => {
    const from = start + i
    return {
      value: `${pad(from)}:00`,
      label: `${pad(from)}:00 – ${pad(from + 1)}:00`,
    }
  })

  return [
    ...windows,
    { value: "later", label: `After ${pad(start + 6)}:00` },
    { value: "unsure", label: "I am not sure yet" },
  ]
}

/**
 * Every rule the guest has to satisfy, in one place. Validation used to be an
 * `if` chain that fired a toast and moved on — nothing marked the offending
 * field, so a guest with a typo in their email had to guess which box was
 * wrong before the toast faded.
 */
const checkoutSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name"),
    lastName: z.string().trim().min(1, "Enter your last name"),
    email: z.email("Enter a valid email address, e.g. you@example.com"),
    phone: z
      .string()
      .trim()
      .min(6, "Enter a number the property can reach you on"),
    country: z.string().trim().min(1, "Enter your country or region"),
    arrivalTime: z.string().min(1, "Choose an estimated arrival time"),
    specialRequests: z.string().max(500, "Keep requests under 500 characters"),
    payMethod: z.enum(["card", "property"]),
    cardName: z.string(),
    cardNumber: z.string(),
    cardExpiry: z.string(),
    cardCvv: z.string(),
    agree: z.literal(true, {
      error: "Accept the terms and cancellation policy to confirm",
    }),
  })
  .superRefine((data, ctx) => {
    // Card details only matter when the guest is paying now.
    if (data.payMethod !== "card") return

    if (data.cardName.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["cardName"],
        message: "Enter the name printed on the card",
      })
    }
    const digits = data.cardNumber.replace(/\s/g, "")
    if (!/^\d{13,19}$/.test(digits)) {
      ctx.addIssue({
        code: "custom",
        path: ["cardNumber"],
        message: "Enter a valid card number",
      })
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(data.cardExpiry)) {
      ctx.addIssue({
        code: "custom",
        path: ["cardExpiry"],
        message: "Use MM/YY",
      })
    }
    if (!/^\d{3,4}$/.test(data.cardCvv)) {
      ctx.addIssue({
        code: "custom",
        path: ["cardCvv"],
        message: "3 or 4 digits",
      })
    }
  })

type CheckoutValues = z.input<typeof checkoutSchema>

/** Which fields each step is responsible for, so Continue only validates what
 *  the guest can actually see. */
const stepFields: Record<number, FieldPath<CheckoutValues>[]> = {
  1: ["firstName", "lastName", "email", "phone", "country", "arrivalTime", "specialRequests"],
  2: [],
  3: ["payMethod", "cardName", "cardNumber", "cardExpiry", "cardCvv"],
  4: ["agree"],
}

/** 4242424242424242 → 4242 4242 4242 4242 */
function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim()
}

/** 1226 → 12/26 */
function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

/**
 * Checkout, against the real API.
 *
 * Three things changed with the wire, and each of them is a rule:
 *
 *  - the PRICE comes from `POST /quote` and nothing is computed here (#13)
 *  - a booking is created `pending`, holds inventory for fifteen minutes, and
 *    only becomes `confirmed` when the money settles (#44) — it used to be
 *    written straight to a store with a `paid` flag the client chose
 *  - the booking is made from the signed quote TOKEN, never from a total this
 *    component could put in the request
 */
export function CheckoutFlow({
  slug,
  roomId,
  ratePlanId,
  checkIn,
  checkOut,
  guests,
}: {
  slug: string
  roomId: string
  ratePlanId: string
  checkIn: string
  checkOut: string
  guests: number
}) {
  const router = useRouter()
  const { data: detail, isLoading: loadingHotel, error: hotelError } = useProperty(slug)
  const { data: session } = useSession()
  const quote = useQuote(slug)
  const createBooking = useCreateBooking()
  const startPayment = useStartPayment()

  const [step, setStep] = React.useState(1)
  const [addOnIds, setAddOnIds] = React.useState<string[]>([])
  // Confirm writes synchronously, so a double-click used to land two
  // reservations — and two charges — before the route change happened.
  const [submitting, setSubmitting] = React.useState(false)

  const {
    register,
    control,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors },
  } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    // Prefilled from the SESSION when there is one. A signed-out guest gets a
    // blank form rather than somebody else's details from a stale store.
    defaultValues: {
      firstName: session?.firstName ?? "",
      lastName: session?.lastName ?? "",
      email: session?.email ?? "",
      phone: "",
      country: "",
      /* Left empty: the windows depend on the property, and guessing one for
         the guest is how "15:00–16:00" gets sent for a 14:00 check-in. */
      arrivalTime: "",
      specialRequests: "",
      payMethod: "card",
      cardName: "",
      cardNumber: "",
      cardExpiry: "",
      cardCvv: "",
      agree: false as unknown as true,
    },
  })

  // useWatch rather than watch() — the latter returns an unmemoizable function
  // and makes the React Compiler skip this whole component.
  const payMethod = useWatch({ control, name: "payMethod" })

  /*
   * A fresh quote, and a new one whenever the extras change.
   *
   * Checkout does NOT reuse the token the reserve card minted — it would
   * already be ageing while the guest read the page, and rule #13 gives it a
   * lifetime for a reason. The guest should start paying against a token that
   * was issued for this screen.
   */
  const requestQuote = quote.mutate
  React.useEffect(() => {
    const room = detail?.rooms.find((r) => r.id === roomId) ?? detail?.rooms[0]
    const plan =
      room?.ratePlans.find((p) => p.id === ratePlanId) ??
      room?.ratePlans.find((p) => p.isDefault) ??
      room?.ratePlans[0]
    if (!room || !plan) return

    requestQuote({
      roomId: room.id,
      ratePlanId: plan.id,
      checkIn,
      checkOut,
      adults: guests,
      children: 0,
      // Ids and quantities only. What each one COSTS for this stay is the
      // server's answer (rule #10).
      addOns: addOnIds.map((valueAddId) => ({ valueAddId, qty: 1 })),
    })
  }, [requestQuote, detail, roomId, ratePlanId, checkIn, checkOut, guests, addOnIds])

  if (loadingHotel) {
    return (
      <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading checkout">
        <div className="h-6 w-1/3 rounded bg-muted" />
        <div className="h-48 w-full rounded-xl bg-muted" />
      </div>
    )
  }

  if (!detail) {
    return (
      <NotFoundCard
        title={hotelError?.isNotFound ? "Hotel not found" : "Could not load this booking"}
        description={hotelError?.message ?? "We couldn't find the property you were booking."}
        href="/hotels"
        cta="Browse hotels"
      />
    )
  }

  const hotel = toHotel(detail)
  const roomDetail = detail.rooms.find((r) => r.id === roomId) ?? detail.rooms[0]
  // The UI shape, for the components that still speak it.
  const room = hotel.rooms.find((r) => r.id === roomDetail?.id) ?? hotel.rooms[0]
  const availableAddOns = hotel.valueAdds

  /*
   * Add-ons go to the SERVER as ids and quantities.
   *
   * Their prices come back in the quote, resolved for this stay's nights and
   * party — which is the whole of rule #10, and not something the client gets
   * to work out. `valueAddPrice()` used to do it here and could disagree.
   */
  const quotedAddOns = quote.data?.addOns ?? []
  const addOns: BookingAddOn[] = quotedAddOns.map((a) => ({
    id: a.valueAddId,
    name: a.name,
    price: a.amount,
    qty: a.qty,
  }))

  const priced = quote.data
  /*
   * Captured before the guard below, deliberately.
   *
   * A re-quote can fail while an earlier one still holds a price — changing
   * the extras, or the room going in the meantime. Reading `quote.error`
   * afterwards narrows to `never`, because the mutation result is a union and
   * TypeScript has concluded from `data` that there is no error. There can be.
   */
  const quoteError = quote.error
  const soldOut = quoteError?.statusCode === 409

  /*
   * No price, no checkout.
   *
   * The screen used to compute one locally, so there was always something to
   * render. There is not any more, and showing a form with a blank total —
   * or worse, a stale one — is how a guest agrees to a number nobody quoted.
   */
  if (!priced) {
    return (
      <div className="space-y-4">
        {soldOut || quoteError ? (
          <NotFoundCard
            title={soldOut ? "Those dates just went" : "Could not price this stay"}
            description={quoteError?.message ?? "Try different dates."}
            href={`/hotels/${slug}`}
            cta="Back to the hotel"
          />
        ) : (
          <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Pricing your stay">
            <div className="h-6 w-1/3 rounded bg-muted" />
            <div className="h-48 w-full rounded-xl bg-muted" />
          </div>
        )}
      </div>
    )
  }

  async function next() {
    const valid = await trigger(stepFields[step])
    if (!valid) {
      toast.error("Check the highlighted fields")
      return
    }
    setStep((s) => Math.min(steps.length, s + 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function back() {
    setStep((s) => Math.max(1, s - 1))
  }

  /**
   * Confirming (rules #13, #23, #44).
   *
   * Three calls, in this order and no other:
   *
   *  1. the booking, made from the signed quote TOKEN — the total is never in
   *     the request, so a client cannot name its own price
   *  2. the payment, opened against the booking that now holds inventory
   *  3. the confirmation page, which waits for the money to settle
   *
   * The booking comes back `pending` with a fifteen-minute hold. It is not a
   * reservation yet, and saying so here would be a lie the guest finds out
   * about later.
   */
  async function confirm(values: CheckoutValues) {
    if (submitting) return
    if (!priced) {
      toast.error("We could not price this stay. Try again.")
      return
    }
    setSubmitting(true)

    try {
      const { booking } = await createBooking.mutateAsync({
        quoteToken: priced.quoteToken,
        guest: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          country: values.country,
        },
        arrivalTime: values.arrivalTime,
        specialRequests: values.specialRequests,
      })

      /*
       * Payment is opened but NOT awaited to completion.
       *
       * Settlement reaches the API as a webhook from the provider, which can
       * land after this request returns. The confirmation page polls for it —
       * blocking here would leave the guest on a spinner over something this
       * browser is not part of.
       */
      await startPayment.mutateAsync(booking.id)

      router.push(`/checkout/confirmation?booking=${booking.id}`)
    } catch (error) {
      setSubmitting(false)
      const message =
        error instanceof ApiError ? error.message : "Something went wrong. Try again."
      /*
       * A 409 here is the room going in the seconds the guest spent on the
       * card form. It is the one failure that is not worth retrying, and the
       * API sends back the rooms that ARE still free (rule #24).
       */
      toast.error("We couldn't confirm that booking", { description: message })
    }
  }

  const summary = (
    <PriceSummary
      hotel={hotel}
      room={room}
      checkIn={checkIn}
      checkOut={checkOut}
      guests={guests}
      addOns={addOns}
      pricing={priced.pricing}
    />
  )

  return (
    <form onSubmit={handleSubmit(confirm)} noValidate>
      {/* STEPPER */}
      <ol className="flex items-center">
        {steps.map((s, i) => (
          <li key={s.n} className={cn("flex items-center", i < steps.length - 1 && "flex-1")}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                  step >= s.n
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "text-muted-foreground"
                )}
                aria-current={step === s.n ? "step" : undefined}
              >
                {s.n}
              </span>
              <span
                className={cn(
                  "hidden text-sm font-medium sm:inline",
                  step >= s.n ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span
                className={cn(
                  "mx-2 h-px flex-1 transition-colors sm:mx-4",
                  step > s.n ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}
          </li>
        ))}
      </ol>

      {soldOut ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive mt-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          {quoteError?.message ?? "Not available for these dates."}
        </div>
      ) : null}

      {/* MOBILE TOTAL — the summary card is desktop-only, so on a phone the
          guest used to type card details with the price entirely off-screen. */}
      <MobileTotal total={priced.pricing.total} nights={priced.pricing.nights}>
        {summary}
      </MobileTotal>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* LEFT — the steps */}
        <div className="min-w-0">
          {step === 1 ? (
            <Card>
              <CardContent className="space-y-5">
                <h2 className="font-heading text-lg font-semibold">Your Details</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="First name" htmlFor="first-name" error={errors.firstName?.message}>
                    <Input
                      id="first-name"
                      autoComplete="given-name"
                      aria-invalid={!!errors.firstName}
                      {...register("firstName")}
                    />
                  </Field>
                  <Field label="Last name" htmlFor="last-name" error={errors.lastName?.message}>
                    <Input
                      id="last-name"
                      autoComplete="family-name"
                      aria-invalid={!!errors.lastName}
                      {...register("lastName")}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Email" htmlFor="email" error={errors.email?.message}>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                      {...register("email")}
                    />
                  </Field>
                  <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
                    <Input
                      id="phone"
                      type="tel"
                      autoComplete="tel"
                      aria-invalid={!!errors.phone}
                      {...register("phone")}
                    />
                  </Field>
                </div>
                <Field label="Country / Region" htmlFor="country" error={errors.country?.message}>
                  <Input
                    id="country"
                    autoComplete="country-name"
                    aria-invalid={!!errors.country}
                    {...register("country")}
                  />
                </Field>

                {/* The property states a check-in time, so we ask when to expect
                    the guest — the confirmation printed an arrival window we
                    never actually collected. */}
                <Field
                  label={`Estimated arrival (check-in from ${formatTime24(hotel.policies.checkInTime)})`}
                  error={errors.arrivalTime?.message}
                >
                  <Controller
                    control={control}
                    name="arrivalTime"
                    render={({ field }) => (
                      <Select
                        items={arrivalWindows(hotel.policies.checkInTime)}
                        value={field.value}
                        onValueChange={(v) => field.onChange(v as string)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {arrivalWindows(hotel.policies.checkInTime).map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field
                  label="Special requests (optional)"
                  htmlFor="requests"
                  error={errors.specialRequests?.message}
                >
                  <Textarea
                    id="requests"
                    rows={3}
                    aria-invalid={!!errors.specialRequests}
                    placeholder="Room preference, celebrating something, dietary needs…"
                    {...register("specialRequests")}
                  />
                </Field>
              </CardContent>
            </Card>
          ) : null}

          {step === 2 ? (
            <Card>
              <CardContent className="space-y-5">
                <div>
                  <h2 className="font-heading text-lg font-semibold">Add to your stay</h2>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Extras offered by {hotel.name}. You can skip this step.
                  </p>
                </div>
                <div className="space-y-3">
                  {availableAddOns.map((v) => {
                    /*
                     * The UNIT price, with its unit spelled out — not a total.
                     *
                     * The server resolves what an extra costs for this stay's
                     * nights and party (rule #10), and it only does so for the
                     * ones actually chosen. Working the total out here for an
                     * unticked box would be the local pricing coming back
                     * through the side door, and it is exactly the arithmetic
                     * that once charged "Daily breakfast" once for three
                     * nights. Ticking it puts the real figure in the summary.
                     */
                    const price = v.price
                    const checked = addOnIds.includes(v.id)
                    return (
                      <label
                        key={v.id}
                        className="hover:bg-accent/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setAddOnIds((ids) =>
                              ids.includes(v.id) ? ids.filter((i) => i !== v.id) : [...ids, v.id]
                            )
                          }
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{v.name}</span>
                            <Badge variant="outline">{v.category}</Badge>
                          </div>
                          <p className="text-muted-foreground text-sm">{v.description}</p>
                        </div>
                        <span className="shrink-0 text-sm font-medium">
                          {formatCurrency(price)}
                          <span className="text-muted-foreground block text-xs font-normal">
                            {valueAddUnitLabel[v.unit]}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {step === 3 ? (
            <Card>
              <CardContent className="space-y-5">
                <h2 className="font-heading text-lg font-semibold">Payment</h2>
                <Controller
                  control={control}
                  name="payMethod"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as "card" | "property")}
                      className="gap-2"
                    >
                      <label className="hover:bg-accent/50 flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors">
                        <RadioGroupItem value="card" />
                        <CreditCard className="size-4" />
                        Pay now by card
                      </label>
                      <label className="hover:bg-accent/50 flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition-colors">
                        <RadioGroupItem value="property" />
                        <Building2 className="size-4" />
                        Pay at the property
                      </label>
                    </RadioGroup>
                  )}
                />

                {payMethod === "card" ? (
                  <div className="space-y-4">
                    <Field label="Name on card" htmlFor="card-name" error={errors.cardName?.message}>
                      <Input
                        id="card-name"
                        autoComplete="cc-name"
                        aria-invalid={!!errors.cardName}
                        {...register("cardName")}
                      />
                    </Field>
                    <Field
                      label="Card number"
                      htmlFor="card-number"
                      error={errors.cardNumber?.message}
                    >
                      <div className="relative">
                        <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                        <Controller
                          control={control}
                          name="cardNumber"
                          render={({ field }) => (
                            <Input
                              id="card-number"
                              inputMode="numeric"
                              autoComplete="cc-number"
                              placeholder="4242 4242 4242 4242"
                              className="pl-8"
                              aria-invalid={!!errors.cardNumber}
                              value={field.value}
                              onBlur={field.onBlur}
                              onChange={(e) => field.onChange(formatCardNumber(e.target.value))}
                            />
                          )}
                        />
                      </div>
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Expiry" htmlFor="card-expiry" error={errors.cardExpiry?.message}>
                        <Controller
                          control={control}
                          name="cardExpiry"
                          render={({ field }) => (
                            <Input
                              id="card-expiry"
                              inputMode="numeric"
                              autoComplete="cc-exp"
                              placeholder="MM/YY"
                              aria-invalid={!!errors.cardExpiry}
                              value={field.value}
                              onBlur={field.onBlur}
                              onChange={(e) => field.onChange(formatExpiry(e.target.value))}
                            />
                          )}
                        />
                      </Field>
                      <Field label="CVV" htmlFor="card-cvv" error={errors.cardCvv?.message}>
                        <Input
                          id="card-cvv"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          placeholder="123"
                          maxLength={4}
                          aria-invalid={!!errors.cardCvv}
                          {...register("cardCvv")}
                        />
                      </Field>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">{hotel.policies.payment}</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {step === 4 ? (
            <ReviewStep
              values={getValues()}
              room={room}
              guests={guests}
              checkIn={checkIn}
              checkOut={checkOut}
              nights={priced.pricing.nights}
              addOns={addOns}
            >
              <div>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
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
                  {/* Both documents exist now, so the guest can actually read
                      what they are being asked to accept. */}
                  <span>
                    I accept the{" "}
                    <Link href="/terms" className="underline underline-offset-4">
                      terms &amp; conditions
                    </Link>{" "}
                    and the property&apos;s{" "}
                    <Link
                      href="/cancellation-policy"
                      className="underline underline-offset-4"
                    >
                      cancellation policy
                    </Link>
                    .
                  </span>
                </label>
                {errors.agree ? (
                  <p className="text-destructive mt-1.5 text-sm">{errors.agree.message}</p>
                ) : null}
              </div>
            </ReviewStep>
          ) : null}

          {/* NAV */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button type="button" variant="outline" onClick={back} disabled={step === 1}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            {step < steps.length ? (
              <Button type="button" onClick={next}>
                {step === 2 && addOnIds.length === 0 ? "Skip" : "Continue"}
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button type="submit" size="lg" disabled={soldOut || submitting}>
                {submitting ? "Confirming…" : "Confirm Booking"}
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT — summary (desktop) */}
        <div className="hidden min-w-0 lg:block">
          <Card className="overflow-hidden pt-0 lg:sticky lg:top-24">
            <div className="relative h-36 w-full">
              <Image
                src={hotelImage(hotel.seed, 600, 400)}
                alt={hotel.name}
                fill
                sizes="360px"
                className="object-cover"
              />
            </div>
            <CardContent>{summary}</CardContent>
          </Card>
        </div>
      </div>
    </form>
  )
}

/** Read-only recap of everything the guest entered. Values are read once with
 *  `getValues()` — the step only mounts after its inputs have been validated,
 *  so it needs a snapshot, not a live subscription. */
function ReviewStep({
  values,
  room,
  guests,
  checkIn,
  checkOut,
  nights,
  addOns,
  children,
}: {
  values: CheckoutValues
  room: Room
  guests: number
  checkIn: string
  checkOut: string
  nights: number
  addOns: BookingAddOn[]
  children: React.ReactNode
}) {
  const nightLabel = nights === 1 ? "night" : "nights"

  return (
    <Card>
      <CardContent className="space-y-5">
        <h2 className="font-heading text-lg font-semibold">Review &amp; Confirm</h2>
        <dl className="space-y-3 text-sm">
          <Row label="Lead guest">
            {values.firstName} {values.lastName}
          </Row>
          <Row label="Contact">
            {values.email} · {values.phone}
          </Row>
          <Row label="Country">{values.country}</Row>
          <Row label="Stay">
            {formatDate(checkIn)} → {formatDate(checkOut)} ({nights} {nightLabel})
          </Row>
          <Row label="Room">{room.name}</Row>
          <Row label="Guests">{guests}</Row>
          <Row label="Arrival">{values.arrivalTime}</Row>
          <Row label="Payment">
            {values.payMethod === "card" ? "Card — paid now" : "Pay at the property"}
          </Row>
          {addOns.length > 0 ? (
            <Row label="Extras">{addOns.map((a) => a.name).join(", ")}</Row>
          ) : null}
          {values.specialRequests ? (
            <Row label="Requests">{values.specialRequests}</Row>
          ) : null}
        </dl>

        <Separator />

        {children}
      </CardContent>
    </Card>
  )
}

/** Collapsed on mobile so the total is always in view, expandable for the
 *  itemised breakdown. */
function MobileTotal({
  total,
  nights,
  children,
}: {
  total: number
  nights: number
  children: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className="bg-background/95 supports-[backdrop-filter]:bg-background/85 sticky top-26 z-30 -mx-4 mt-6 border-y backdrop-blur sm:-mx-6 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-6"
      >
        <span>
          <span className="text-muted-foreground block text-xs">
            Total for {nights} {nights === 1 ? "night" : "nights"}
          </span>
          <span className="font-heading text-lg font-semibold">
            {formatCurrency(total)}
          </span>
        </span>
        <span className="text-muted-foreground flex items-center gap-1 text-sm">
          {open ? "Hide" : "Details"}
          <ChevronDown
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </span>
      </button>
      {open ? <div className="border-t px-4 py-4 sm:px-6">{children}</div> : null}
    </div>
  )
}

/** The itemised breakdown, shared by the desktop sidebar and the mobile
 *  expander so the two can never drift apart. */
function PriceSummary({
  hotel,
  room,
  checkIn,
  checkOut,
  guests,
  addOns,
  pricing,
}: {
  hotel: Hotel
  room: Room
  checkIn: string
  checkOut: string
  guests: number
  addOns: BookingAddOn[]
  /** The server's breakdown. Nothing on this screen computes a price. */
  pricing: Quote["pricing"]
}) {
  const nightLabel = pricing.nights === 1 ? "night" : "nights"

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-heading font-semibold">{hotel.name}</h3>
        <p className="text-muted-foreground flex items-center gap-1 text-sm">
          <MapPin className="size-3.5" />
          {hotel.city}, {hotel.country}
        </p>
      </div>

      <Separator />

      <div className="space-y-1 text-sm">
        <p className="font-medium">{room.name}</p>
        <p className="text-muted-foreground">
          {formatDate(checkIn)} → {formatDate(checkOut)}
        </p>
        <p className="text-muted-foreground">
          {guests} {guests === 1 ? "guest" : "guests"} · {pricing.nights} {nightLabel}
        </p>
      </div>

      <Separator />

      <div className="space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            {formatCurrency(pricing.ratePerNight)} × {pricing.nights} {nightLabel}
          </span>
          <span className="font-medium">{formatCurrency(pricing.roomSubtotal)}</span>
        </div>
        {pricing.discount ? (
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span>{pricing.discount.label}</span>
            <span className="font-medium">{formatCurrency(pricing.discount.amount)}</span>
          </div>
        ) : null}
        {addOns.map((a) => (
          <div key={a.id} className="flex items-center justify-between">
            <span className="text-muted-foreground">{a.name}</span>
            <span className="font-medium">{formatCurrency(a.price * a.qty)}</span>
          </div>
        ))}
        <Separator />
        <div className="flex items-center justify-between text-base">
          <span className="font-heading font-semibold">Total</span>
          <span className="font-heading font-semibold">{formatCurrency(pricing.total)}</span>
        </div>
      </div>

      <div className="text-muted-foreground flex items-start gap-2 text-xs">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        {hotel.policies.cancellation}
      </div>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right font-medium">{children}</dd>
    </div>
  )
}
