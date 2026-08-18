"use client"

import * as React from "react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowLeft, Eye, Plus } from "lucide-react"

import { formatDate } from "@/lib/format"
import type { InvoicePreview } from "@/lib/admin/types"
import { adminProperties, propertyName } from "@/data/admin"
import { useIssueInvoice, usePreviewInvoice } from "@/lib/admin/api/hooks"
import { DescriptionList, Money } from "@/components/admin/shared"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

/**
 * Two-step flow (Phase 1, D7).
 *
 * The Figma's dialog ended on "Preview Invoice" with no preview screen and no
 * way to actually issue anything. Step 1 collects the period, step 2 shows the
 * computed preview, and only then can the invoice be issued. Dates use the
 * project's Calendar rather than the raw `<input type="date">` the Figma had.
 */
const ELIGIBLE = adminProperties.filter((p) => p.status === "Active")

const PROPERTY_ITEMS = ELIGIBLE.map((property) => ({
  label: `${property.name} — ${property.city}`,
  value: property.id,
}))

const schema = z
  .object({
    invoiceNumber: z
      .string()
      .trim()
      .regex(
        /^STY-INV-[A-Z0-9-]{4,}$/i,
        "Use the STY-INV-… format, e.g. STY-INV-2026-0701."
      ),
    propertyId: z.string().min(1, "Choose the property to invoice."),
    periodStart: z.string().min(1, "Pick a start date."),
    periodEnd: z.string().min(1, "Pick an end date."),
    notes: z.string().trim().max(500, "Keep notes under 500 characters."),
  })
  .refine((v) => new Date(v.periodEnd) >= new Date(v.periodStart), {
    message: "The end date must be on or after the start date.",
    path: ["periodEnd"],
  })
  .refine(
    (v) =>
      new Date(v.periodEnd).getTime() - new Date(v.periodStart).getTime() <=
      366 * 86_400_000,
    { message: "A billing period cannot exceed one year.", path: ["periodEnd"] }
  )

type FormValues = z.infer<typeof schema>

function isoToday(offsetDays = 0) {
  return new Date(Date.now() + offsetDays * 86_400_000)
    .toISOString()
    .slice(0, 10)
}

/** Sequential-looking suggestion; the API rejects true duplicates. */
function suggestInvoiceNumber() {
  const now = new Date()
  return `STY-INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}${String(
    now.getDate()
  ).padStart(2, "0")}`
}

export function GenerateInvoiceDialog() {
  const [open, setOpen] = React.useState(false)
  // `openCount` keys the body so each open mounts a fresh form and clears any
  // previous preview — no state-syncing effect required.
  const [openCount, setOpenCount] = React.useState(0)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setOpenCount((n) => n + 1)
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Generate invoice
          </Button>
        }
      />
      {open ? (
        <GenerateInvoiceBody key={openCount} onDone={() => setOpen(false)} />
      ) : null}
    </Dialog>
  )
}

function GenerateInvoiceBody({ onDone }: { onDone: () => void }) {
  const [preview, setPreview] = React.useState<InvoicePreview | null>(null)
  const buildPreview = usePreviewInvoice()
  const issue = useIssueInvoice()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoiceNumber: suggestInvoiceNumber(),
      propertyId: PROPERTY_ITEMS[0]?.value ?? "",
      periodStart: isoToday(-14),
      periodEnd: isoToday(),
      notes: "",
    },
  })

  return (
    <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {preview ? "Review invoice" : "Generate invoice"}
          </DialogTitle>
          <DialogDescription>
            {preview
              ? "Check the computed totals before issuing to the client."
              : "Configure the invoice details and billing period."}
          </DialogDescription>
        </DialogHeader>

        {preview ? (
          <div className="space-y-4">
            <DescriptionList
              columns={2}
              items={[
                { label: "Invoice number", value: preview.invoiceNumber },
                {
                  label: "Property",
                  value: propertyName(preview.propertyId),
                },
                { label: "Owner", value: preview.ownerName },
                {
                  label: "Period",
                  value: `${formatDate(preview.periodStart)} – ${formatDate(preview.periodEnd)}`,
                },
              ]}
            />

            <dl className="space-y-2 rounded-lg border p-4 text-sm">
              <Row label="Transactions" value={String(preview.transactions)} />
              <Row
                label="Gross revenue"
                value={<Money value={preview.grossRevenue} />}
              />
              <Row
                label={`Commission (${(preview.commissionRate * 100).toFixed(0)}%)`}
                value={<Money value={preview.subtotal} />}
              />
              <Row
                label={`${preview.taxLabel} (${(preview.taxRate * 100).toFixed(1)}%)`}
                value={<Money value={preview.taxAmount} />}
              />
              <div className="flex items-center justify-between border-t pt-2 font-medium">
                <dt>Total</dt>
                <dd>
                  <Money value={preview.total} />
                </dd>
              </div>
            </dl>

            {preview.notes ? (
              <div>
                <p className="text-muted-foreground text-xs">Notes</p>
                <p className="text-sm text-pretty">{preview.notes}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <Form {...form}>
            <form
              id="generate-invoice-form"
              onSubmit={form.handleSubmit((values) =>
                buildPreview.mutate(values, { onSuccess: setPreview })
              )}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice number</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      Auto-generated — edit if your finance system needs a
                      specific number.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property</FormLabel>
                    <Select
                      items={PROPERTY_ITEMS}
                      value={field.value}
                      onValueChange={(value) => field.onChange(String(value))}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a property" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROPERTY_ITEMS.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Only active properties can be invoiced.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <DateField
                  control={form.control}
                  name="periodStart"
                  label="Start date"
                />
                <DateField
                  control={form.control}
                  name="periodEnd"
                  label="End date"
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice notes</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="Any notes or terms to include on the invoice…"
                      />
                    </FormControl>
                    <NotesCounter control={form.control} />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        )}

        <DialogFooter>
          {preview ? (
            <>
              <Button variant="outline" onClick={() => setPreview(null)}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
              <Button
                disabled={issue.isPending}
                onClick={() =>
                  issue.mutate(preview, { onSuccess: () => onDone() })
                }
              >
                {issue.isPending ? "Issuing…" : "Issue invoice"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onDone()}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="generate-invoice-form"
                disabled={buildPreview.isPending}
              >
                <Eye className="size-4" />
                {buildPreview.isPending ? "Calculating…" : "Preview invoice"}
              </Button>
            </>
          )}
        </DialogFooter>
    </DialogContent>
  )
}

/**
 * Live character count. Isolated into its own component so the parent doesn't
 * need `form.watch()`, which makes the React Compiler skip compilation.
 */
function NotesCounter({
  control,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"]
}) {
  const notes = useWatch({ control, name: "notes" }) ?? ""
  return <FormDescription>{notes.length}/500</FormDescription>
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/** Calendar-backed date field — replaces the Figma's native date inputs. */
function DateField({
  control,
  name,
  label,
}: {
  control: ReturnType<typeof useForm<FormValues>>["control"]
  name: "periodStart" | "periodEnd"
  label: string
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start font-normal"
                >
                  {field.value ? formatDate(field.value) : "Pick a date"}
                </Button>
              }
            />
            <PopoverContent align="start" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={field.value ? new Date(field.value) : undefined}
                onSelect={(date) => {
                  if (date) field.onChange(date.toISOString().slice(0, 10))
                  setOpen(false)
                }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
