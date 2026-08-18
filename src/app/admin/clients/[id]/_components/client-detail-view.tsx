"use client"

import Link from "next/link"

import { formatDate } from "@/lib/format"
import { useClient } from "@/lib/admin/api/hooks"
import {
  AdminPageHeader,
  DescriptionList,
  Money,
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

/** Tenant detail — the destination the Figma's "Client" columns never had. */
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
              { label: "Contact person", value: client.contactPerson },
              { label: "Email", value: client.email },
              { label: "Phone", value: client.phone },
              { label: "Country", value: client.country },
              { label: "Joined", value: formatDate(client.joined) },
              {
                label: "Plan",
                value: <Badge variant="secondary">{client.plan}</Badge>,
              },
              {
                label: "Commission",
                value: `${(client.commissionRate * 100).toFixed(0)}%`,
              },
              {
                label: "Monthly revenue",
                value: <Money value={client.monthlyRevenue} />,
              },
              { label: "Occupancy", value: `${client.occupancy}%` },
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
                      {manager.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {manager.role}
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
              <TableHead scope="col" className="text-right">Rooms</TableHead>
              <TableHead scope="col" className="text-right">Occupancy</TableHead>
              <TableHead scope="col" className="text-right">ADR</TableHead>
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
                  <StarRating value={property.stars} showValue={false} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {property.rooms}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {property.occupancy}%
                </TableCell>
                <TableCell className="text-right">
                  <Money value={property.adr} />
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
