"use client"

import Link from "next/link"

import { formatCurrency, formatDate } from "@/lib/format"
import { useClient } from "@/lib/admin/api/hooks"
import {
  AdminPageHeader,
  DescriptionList,
  SectionCard,
  StarRating,
  StatusPill,
} from "@/components/admin/shared"
import { ErrorState } from "@/components/shared/states"
import { CardListSkeleton } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

/**
 * Tenant detail — the destination the Figma's "Client" columns never had.
 *
 * Four figures the old version showed are gone, because the API does not know
 * them and neither did anything else: a named "contact person" (the
 * organisation has a contact ADDRESS, not a person — the people are the team
 * below), a monthly revenue and an occupancy for the org, and a per-property
 * occupancy and ADR. Those last three are real questions, and Finance and
 * Analytics answer them for a chosen window — which is the part that makes
 * them answerable at all. A number with no window is not a measurement.
 */
export function ClientDetailView({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useClient(id)

  if (error) {
    return (
      <ErrorState
        variant="page"
        title="Client not found"
        error={error}
        onRetry={() => void refetch()}
      />
    )
  }

  if (isLoading || !data) {
    return <CardListSkeleton count={3} />
  }

  const { client, properties, managers } = data

  return (
    <div className="space-y-6">
      <AdminPageHeader title={client.name} subtitle={`${client.id} · ${client.country}`}>
        <StatusPill status={client.status} />
      </AdminPageHeader>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Organisation" className="lg:col-span-2">
          <DescriptionList
            columns={3}
            items={[
              { label: "Contact email", value: client.contactEmail },
              { label: "Phone", value: client.contactPhone || "—" },
              { label: "Country", value: client.country || "—" },
              { label: "Joined", value: formatDate(client.createdAt) },
              {
                label: "Plan",
                value: <Badge variant="secondary">{client.planTier}</Badge>,
              },
              {
                /*
                 * Basis points, shown as a percentage.
                 *
                 * `1250` is exactly 12.5% — stored as an integer so a
                 * negotiated rate never becomes a float, and divided only
                 * here, for the eye.
                 */
                label: "Commission",
                value: `${(client.commissionRateBps / 100).toFixed(2)}%`,
              },
              { label: "Properties", value: String(properties.length) },
              { label: "Team", value: String(managers.length) },
            ]}
          />
        </SectionCard>

        <SectionCard title="Team">
          {managers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No managers assigned yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {managers.map((manager) => (
                <li
                  key={manager.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {manager.firstName} {manager.lastName}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {manager.role}
                      {manager.jobTitle ? ` · ${manager.jobTitle}` : ""}
                    </span>
                  </span>
                  <StatusPill status={manager.status} />
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            render={<Link href="/admin/users">Manage team</Link>}
          />
        </SectionCard>
      </div>

      <SectionCard
        title={`Properties (${properties.length})`}
        contentClassName="px-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-6">Property</TableHead>
              <TableHead scope="col">Location</TableHead>
              <TableHead scope="col">Rating</TableHead>
              <TableHead scope="col" className="text-right">From</TableHead>
              <TableHead scope="col">Listed</TableHead>
              <TableHead scope="col">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => (
              <TableRow key={property.id}>
                <TableCell className="pl-6">
                  <Link
                    href={`/admin/properties/${property.id}`}
                    className="hover:text-primary font-medium underline-offset-2 hover:underline"
                  >
                    {property.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {property.city}, {property.country}
                </TableCell>
                <TableCell>
                  {property.stars === null ? (
                    <span className="text-muted-foreground text-sm">unrated</span>
                  ) : (
                    <StarRating value={property.stars} showValue={false} />
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {/* Cents. The cheapest rate anything on the property sells at. */}
                  {formatCurrency(property.fromPrice)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(property.createdAt)}
                </TableCell>
                <TableCell>
                  <StatusPill status={property.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  )
}
