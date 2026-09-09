"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import {
  ADMIN_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  RESOURCES,
  accessFor,
  type Access,
  type AdminRole,
} from "@/lib/admin/rbac"
import { usePlatformSettings, useUpdateSettings } from "@/lib/admin/api/hooks"
import { useAdminRole } from "@/components/admin/role-provider"
import { AdminPageHeader, SectionCard, StatusPill } from "@/components/admin/shared"
import { CardListSkeleton } from "@/components/shared/data-table"
import { ErrorState } from "@/components/shared/states"
import { Button } from "@/components/ui/button"
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
import { Label } from "@/components/ui/label"
import { MailHealthLine } from "@/components/admin/mail-health-banner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * The two settings that actually do something (rule #106).
 *
 * `platformName`, `defaultLanguage` and `timezone` are gone: they are deploy
 * configuration, and a form that pretends otherwise is one somebody sets and
 * believes. `trialPeriodDays` and `maxPropertiesFreePlan` described a freemium
 * product that does not exist.
 */
const settingsSchema = z.object({
  supportEmail: z.string().trim().email("Give a real address."),
  /*
   * `z.number()`, not `z.coerce.number()`. Coercion widens the schema's INPUT
   * type to `unknown`, which no longer matches the form's own values — the
   * number arrives as a number because the field converts it on change.
   */
  defaultCommissionRateBps: z
    .number()
    .int("Whole basis points.")
    .min(0, "Cannot be negative.")
    .max(10_000, "100% is the ceiling."),
})

/** What each access level reads as in the permission matrix. */
const ACCESS_LABEL: Record<Access, string> = {
  none: "No access",
  read: "Read only",
  manage: "Full access",
}

const ACCESS_TONE: Record<Access, "neutral" | "warning" | "success"> = {
  none: "neutral",
  read: "warning",
  manage: "success",
}

export function SettingsView() {
  const { data: settings, isLoading, error, refetch } = usePlatformSettings()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Settings"
        subtitle="Support contact, the default commission rate, and what each admin role may do"
      />

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} variant="page" />
      ) : isLoading || !settings ? (
        <CardListSkeleton count={3} />
      ) : (
        <>
          <SettingsForm settings={settings} />
          <PermissionMatrix />
        </>
      )}
    </div>
  )
}

function SettingsForm({ settings }: { settings: z.infer<typeof settingsSchema> }) {
  const update = useUpdateSettings()
  const form = useForm<z.infer<typeof settingsSchema>>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  })

  return (
    <SectionCard title="Platform">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => update.mutate(values))}
          className="grid gap-4 sm:grid-cols-2"
        >
          <FormField
            control={form.control}
            name="supportEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Support email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormDescription>
                  Where a guest or partner replying to one of our emails ends up.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="defaultCommissionRateBps"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default commission (basis points)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={10_000}
                    step={25}
                    {...field}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormDescription>
                  {(Number(field.value) || 0) / 100}% — applied to NEW clients only.
                  Existing agreements keep the rate their invoices were calculated
                  from.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/*
            Plain markup, not form primitives.
            `FormLabel` and `FormControl` call `useFormField()`, which reads the
            context a `FormField` provides — and this block has none, because it
            is not a field. Rendering it threw "useFormField must be used within
            a <FormField>" on every visit to this screen.
          */}
          {/*
            Says the state even when it is fine — unlike the dashboard banner,
            which appears only when something is wrong. This is the page
            somebody opens to ASK, so a silent one would be no answer.
          */}
          <div className="space-y-2 sm:col-span-2">
            <Label>Email delivery</Label>
            <MailHealthLine />
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform-currency">Currency</Label>
            <Input id="platform-currency" value="USD" readOnly disabled />
            <p className="text-muted-foreground text-sm">
              Every price in the product is USD. Multi-currency is not a setting —
              it is a piece of work.
            </p>
          </div>

          <div className="flex items-end sm:col-span-2">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </Form>
    </SectionCard>
  )
}

function PermissionMatrix() {
  const { role: activeRole } = useAdminRole()

  return (
    <SectionCard
      title="Roles & permissions"
      description="Platform admin roles. Tenant-side roles are assigned per manager under Managers & Users."
      contentClassName="px-0"
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-6">Section</TableHead>
              {ADMIN_ROLES.map((role) => (
                <TableHead key={role} scope="col" className="text-center">
                  <span className="block">{ROLE_LABELS[role]}</span>
                  {role === activeRole ? (
                    <span className="text-muted-foreground text-[10px] font-normal">
                      (acting)
                    </span>
                  ) : null}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {RESOURCES.map((resource) => (
              <TableRow key={resource}>
                <TableCell className="pl-6 font-medium capitalize">
                  {resource}
                </TableCell>
                {ADMIN_ROLES.map((role) => {
                  const access = accessFor(role as AdminRole, resource)
                  return (
                    <TableCell key={role} className="text-center">
                      <StatusPill
                        status={ACCESS_LABEL[access]}
                        tone={ACCESS_TONE[access]}
                        className="mx-auto"
                      />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-muted-foreground space-y-1 px-6 pt-4 text-xs">
        {ADMIN_ROLES.map((role) => (
          <p key={role}>
            <span className="text-foreground font-medium">
              {ROLE_LABELS[role]}
            </span>{" "}
            — {ROLE_DESCRIPTIONS[role]}
          </p>
        ))}
      </div>
    </SectionCard>
  )
}

