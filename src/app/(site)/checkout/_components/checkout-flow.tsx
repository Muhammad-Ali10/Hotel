"use client"

import * as React from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  ClipboardCheck,
  CreditCard,
  Gift,
  Lock,
  MapPin,
  ShieldCheck,
  User,
} from "lucide-react"
import { toast } from "sonner"

import type { BookingAddOn } from "@/types"
import { formatCurrency, formatDate } from "@/lib/format"
import {
  checkStay,
  formatTime24,
  nightsBetween,
  priceBooking,
  valueAddPrice,
} from "@/lib/domain"
import { hotelImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { arrivalTimeSlots } from "@/data/config"
import { useStore } from "@/store"
import { useHotel, useProfile } from "@/store/selectors"
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

const arrivalItems = arrivalTimeSlots.map((slot) => ({ value: slot, label: slot }))

export function CheckoutFlow({
  hotelId,
  roomId,
  checkIn,
  checkOut,
  guests,
}: {
  hotelId: string
  roomId: string
  checkIn: string
  checkOut: string
  guests: number
}) {
  const router = useRouter()
  const hotel = useHotel(hotelId)
  const profile = useProfile()
  const createBooking = useStore((s) => s.createBooking)

  const [step, setStep] = React.useState(1)
  const [addOnIds, setAddOnIds] = React.useState<string[]>([])
  // Prefilled from the signed-in profile — the form used to start blank even
  // though we knew exactly who was booking.
  const [form, setForm] = React.useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    country: profile.country,
    arrivalTime: arrivalTimeSlots[0],
    specialRequests: "",
    payMethod: "card" as "card" | "property",
    cardName: "",
    cardNumber: "",
    cardExpiry: "",
    cardCvv: "",
    agree: false,
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  if (!hotel) {
    return (
      <NotFoundCard
        title="Hotel not found"
        description="We couldn't find the property you were booking."
        href="/hotels"
        cta="Browse hotels"
      />
    )
  }

  const room = hotel.rooms.find((r) => r.id === roomId) ?? hotel.rooms[0]
  const stay = checkStay(hotel.availability, checkIn, checkOut)

  const nights = nightsBetween(checkIn, checkOut)
  const availableAddOns = hotel.valueAdds.filter((v) => v.active)
  const addOns: BookingAddOn[] = addOnIds
    .map((id) => availableAddOns.find((v) => v.id === id))
    .filter((v) => v !== undefined)
    .map((v) => ({
      id: v.id,
      name: v.name,
      price: valueAddPrice(v, { nights, guests }),
      qty: 1,
    }))

  // One pricing function for the whole product — the reserve card quoted from
  // it, the confirmation prints it, and the extranet invoices reconcile to it.
  const pricing = priceBooking({ hotel, room, checkIn, checkOut, guests, addOns })
  const nightLabel = pricing.nights === 1 ? "night" : "nights"

  function validate(current: number) {
    if (current === 1) {
      if (!form.firstName || !form.lastName || !/\S+@\S+\.\S+/.test(form.email)) {
        toast.error("Please enter your name and a valid email.")
        return false
      }
      if (!form.phone.trim()) {
        toast.error("Please enter a phone number so the property can reach you.")
        return false
      }
    }
    if (current === 3 && form.payMethod === "card") {
      if (!form.cardName || !form.cardNumber || !form.cardExpiry || !form.cardCvv) {
        toast.error("Please complete your card details.")
        return false
      }
    }
    return true
  }

  function next() {
    if (!validate(step)) return
    setStep((s) => Math.min(steps.length, s + 1))
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function back() {
    setStep((s) => Math.max(1, s - 1))
  }

  function confirm() {
    if (!form.agree) {
      toast.error("Please accept the terms & conditions to continue.")
      return
    }
    if (!stay.ok) {
      toast.error(stay.message)
      return
    }

    // The booking is written to the store here. It is the same record the
    // dashboard lists and the partner sees in the extranet — checkout used to
    // just build a query string and forget everything else.
    const booking = createBooking({
      hotelId: hotel!.id,
      roomId: room.id,
      guest: {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        country: form.country,
      },
      checkIn,
      checkOut,
      guests,
      arrivalTime: form.arrivalTime,
      specialRequests: form.specialRequests,
      addOns,
      payment: {
        method: form.payMethod,
        status: form.payMethod === "card" ? "paid" : "pending",
      },
    })

    router.push(`/checkout/confirmation?ref=${booking.id}`)
  }

  return (
    <div>
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

      {!stay.ok ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive mt-6 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          {stay.message}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* LEFT — the steps */}
        <div className="min-w-0">
          {step === 1 ? (
            <Card>
              <CardContent className="space-y-5">
                <h2 className="font-heading text-lg font-semibold">Your Details</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="First name" htmlFor="first-name">
                    <Input
                      id="first-name"
                      value={form.firstName}
                      onChange={(e) => set({ firstName: e.target.value })}
                    />
                  </Field>
                  <Field label="Last name" htmlFor="last-name">
                    <Input
                      id="last-name"
                      value={form.lastName}
                      onChange={(e) => set({ lastName: e.target.value })}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Email" htmlFor="email">
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => set({ email: e.target.value })}
                    />
                  </Field>
                  <Field label="Phone" htmlFor="phone">
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => set({ phone: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Country / Region" htmlFor="country">
                  <Input
                    id="country"
                    value={form.country}
                    onChange={(e) => set({ country: e.target.value })}
                  />
                </Field>

                {/* The property states a check-in time, so we ask when to expect
                    the guest — the confirmation printed an arrival window we
                    never actually collected. */}
                <Field
                  label={`Estimated arrival (check-in from ${formatTime24(hotel.policies.checkInTime)})`}
                >
                  <Select
                    items={arrivalItems}
                    value={form.arrivalTime}
                    onValueChange={(v) => set({ arrivalTime: v as string })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {arrivalItems.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Special requests (optional)" htmlFor="requests">
                  <Textarea
                    id="requests"
                    rows={3}
                    value={form.specialRequests}
                    onChange={(e) => set({ specialRequests: e.target.value })}
                    placeholder="Room preference, celebrating something, dietary needs…"
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
                    const price = valueAddPrice(v, { nights: pricing.nights, guests })
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
                            {v.unit}
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
                <RadioGroup
                  value={form.payMethod}
                  onValueChange={(v) => set({ payMethod: v as "card" | "property" })}
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

                {form.payMethod === "card" ? (
                  <div className="space-y-4">
                    <Field label="Name on card" htmlFor="card-name">
                      <Input
                        id="card-name"
                        value={form.cardName}
                        onChange={(e) => set({ cardName: e.target.value })}
                      />
                    </Field>
                    <Field label="Card number" htmlFor="card-number">
                      <div className="relative">
                        <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
                        <Input
                          id="card-number"
                          inputMode="numeric"
                          placeholder="4242 4242 4242 4242"
                          value={form.cardNumber}
                          onChange={(e) => set({ cardNumber: e.target.value })}
                          className="pl-8"
                        />
                      </div>
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Expiry" htmlFor="card-expiry">
                        <Input
                          id="card-expiry"
                          placeholder="MM/YY"
                          value={form.cardExpiry}
                          onChange={(e) => set({ cardExpiry: e.target.value })}
                        />
                      </Field>
                      <Field label="CVV" htmlFor="card-cvv">
                        <Input
                          id="card-cvv"
                          inputMode="numeric"
                          placeholder="123"
                          value={form.cardCvv}
                          onChange={(e) => set({ cardCvv: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {hotel.policies.payment}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {step === 4 ? (
            <Card>
              <CardContent className="space-y-5">
                <h2 className="font-heading text-lg font-semibold">Review &amp; Confirm</h2>
                <dl className="space-y-3 text-sm">
                  <Row label="Lead guest">
                    {form.firstName} {form.lastName}
                  </Row>
                  <Row label="Contact">
                    {form.email} · {form.phone}
                  </Row>
                  <Row label="Country">{form.country}</Row>
                  <Row label="Stay">
                    {formatDate(checkIn)} → {formatDate(checkOut)} ({pricing.nights} {nightLabel})
                  </Row>
                  <Row label="Room">{room.name}</Row>
                  <Row label="Guests">{guests}</Row>
                  <Row label="Arrival">{form.arrivalTime}</Row>
                  <Row label="Payment">
                    {form.payMethod === "card" ? "Card — paid now" : "Pay at the property"}
                  </Row>
                  {addOns.length > 0 ? (
                    <Row label="Extras">{addOns.map((a) => a.name).join(", ")}</Row>
                  ) : null}
                  {form.specialRequests ? (
                    <Row label="Requests">{form.specialRequests}</Row>
                  ) : null}
                </dl>

                <Separator />

                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <Checkbox
                    checked={form.agree}
                    onCheckedChange={(v) => set({ agree: v === true })}
                    className="mt-0.5"
                  />
                  <span>
                    I accept the terms &amp; conditions and the property&apos;s cancellation
                    policy.
                  </span>
                </label>
              </CardContent>
            </Card>
          ) : null}

          {/* NAV */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button variant="outline" onClick={back} disabled={step === 1}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
            {step < steps.length ? (
              <Button onClick={next}>
                Continue
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button size="lg" onClick={confirm} disabled={!stay.ok}>
                Confirm Booking
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT — summary */}
        <div className="min-w-0">
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
            <CardContent className="space-y-4">
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
                {/* Every charge the property configured, itemised — the old
                    summary folded them into one flat 12% "Taxes & fees" line. */}
                {pricing.taxes.map((t) => (
                  <div key={t.id} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t.label}</span>
                    <span className="font-medium">{formatCurrency(t.amount)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between text-base">
                  <span className="font-heading font-semibold">Total</span>
                  <span className="font-heading font-semibold">
                    {formatCurrency(pricing.total)}
                  </span>
                </div>
              </div>

              <div className="text-muted-foreground flex items-start gap-2 text-xs">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {hotel.policies.cancellation}
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
  htmlFor?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
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
