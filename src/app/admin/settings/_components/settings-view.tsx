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
  type AdminRole,
} from "@/lib/admin/rbac"
import {
  useIntegrations,
  usePlatformSettings,
  useToggleIntegration,
  useUpdateSettings,
} from "@/lib/admin/api/hooks"
import { useAdminRole } from "@/components/admin/role-provider"
import {
  AdminPageHeader,
  Icon,
  SectionCard,
  StatusPill,
} from "@/components/admin/shared"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const generalSchema = z.object({
  platformName: z.string().trim().min(2, "Give the platform a name."),
  supportEmail: z.string().trim().email("Enter a valid email address."),
  defaultCurrency: z
    .string()
    .trim()
    .regex(/^[A-Z]{3}$/, "Use a 3-letter uppercase ISO code, e.g. USD."),
  defaultLanguage: z.string().trim().min(2, "Required."),
  timezone: z.string().trim().min(2, "Required."),
})

/**
 * Plain `z.number()` rather than `z.coerce.number()`: coercion makes the
 * schema's input and output types differ, which breaks react-hook-form's
 * resolver generics. The number inputs convert via `valueAsNumber` instead.
 */
const plansSchema = z.object({
  defaultCommissionRate: z
    .number({ message: "Enter a number." })
    .min(0, "Cannot be negative.")
    .max(50, "A commission above 50% is almost certainly a mistake."),
  trialPeriodDays: z
    .number({ message: "Enter a number." })
    .int("Whole days only.")
    .min(0)
    .max(365, "Trials longer than a year are not supported."),
  maxPropertiesFreePlan: z
    .number({ message: "Enter a number." })
    .int("Whole properties only.")
    .min(0)
    .max(100),
})

export function SettingsView() {
  const { data: settings, isLoading, error, refetch } = usePlatformSettings()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Platform Settings"
        subtitle="Roles & permissions, branding, integrations, and platform configuration"
      />

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} variant="page" />
      ) : isLoading || !settings ? (
        <CardListSkeleton count={3} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <GeneralSettingsForm settings={settings.general} />
            <PlanSettingsForm settings={settings.plans} />
          </div>
          <PermissionMatrix />
          <IntegrationsGrid />
        </>
      )}
    </div>
  )
}

function GeneralSettingsForm({
  settings,
}: {
  settings: z.infer<typeof generalSchema>
}) {
  const update = useUpdateSettings()
  const form = useForm<z.infer<typeof generalSchema>>({
    resolver: zodResolver(generalSchema),
    defaultValues: settings,
  })

  return (
    <SectionCard title="General">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) =>
            update.mutate({ general: values })
          )}
          className="space-y-4"
        >
          {(
            [
              ["platformName", "Platform name"],
              ["supportEmail", "Support email"],
              ["defaultCurrency", "Default currency"],
              ["defaultLanguage", "Default language"],
              ["timezone", "Timezone"],
            ] as const
          ).map(([name, label]) => (
            <FormField
              key={name}
              control={form.control}
              name={name}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{label}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}

          <Button type="submit" size="sm" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save general settings"}
          </Button>
        </form>
      </Form>
    </SectionCard>
  )
}

function PlanSettingsForm({
  settings,
}: {
  settings: { defaultCommissionRate: number; trialPeriodDays: number; maxPropertiesFreePlan: number }
}) {
  const update = useUpdateSettings()
  const form = useForm<z.infer<typeof plansSchema>>({
    resolver: zodResolver(plansSchema),
    defaultValues: settings,
  })

  return (
    <SectionCard title="Commission & plans">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) =>
            update.mutate({ plans: values })
          )}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="defaultCommissionRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default commission rate (%)</FormLabel>
                <FormControl>
                  <Input
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    type="number"
                    step="0.5"
                    min={0}
                    max={50}
                  />
                </FormControl>
                <FormDescription>
                  Applied to new clients. Existing contracts keep their agreed
                  rate.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="trialPeriodDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Trial period (days)</FormLabel>
                <FormControl>
                  <Input
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    type="number"
                    min={0}
                    max={365}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxPropertiesFreePlan"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max properties (free plan)</FormLabel>
                <FormControl>
                  <Input
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    type="number"
                    min={0}
                    max={100}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" size="sm" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save plan settings"}
          </Button>
        </form>
      </Form>
    </SectionCard>
  )
}

const ACCESS_LABEL = {
  manage: "Full",
  read: "Read",
  none: "—",
} as const

const ACCESS_TONE = {
  manage: "success",
  read: "info",
  none: "neutral",
} as const

/**
 * The Figma listed five roles with a "Configure" button that went nowhere.
 * This renders the actual signed-off matrix that `lib/admin/rbac.ts` enforces,
 * so what you see is what the app does.
 */
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

function IntegrationsGrid() {
  const { data, isLoading } = useIntegrations()
  const toggle = useToggleIntegration()

  return (
    <SectionCard
      title="Integrations"
      description="Third-party services. None are wired up in this build."
    >
      {isLoading || !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg border" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((integration) => (
            <div
              key={integration.id}
              className="flex items-start gap-3 rounded-lg border p-4"
            >
              <span
                aria-hidden
                className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"
              >
                <Icon name={integration.icon} className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {integration.name}
                </p>
                <p className="text-muted-foreground text-xs text-pretty">
                  {integration.description}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <StatusPill
                    status={integration.connected ? "Connected" : "Not connected"}
                    tone={integration.connected ? "success" : "neutral"}
                  />
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={toggle.isPending}
                    onClick={() => toggle.mutate({ id: integration.id })}
                  >
                    {integration.connected ? "Disconnect" : "Connect"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}
