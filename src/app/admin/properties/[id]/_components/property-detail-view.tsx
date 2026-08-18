"use client"

import Image from "next/image"
import Link from "next/link"
import { MessageSquare } from "lucide-react"

import { formatDate } from "@/lib/format"
import { clientById } from "@/data/admin"
import { useProperty } from "@/lib/admin/api/hooks"
import {
  ActionButton,
  AdminPageHeader,
  DescriptionList,
  Money,
  SectionCard,
  StarRating,
  StatusPill,
} from "@/components/admin/shared"
import { ErrorState } from "@/components/shared/states"
import { CardListSkeleton } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApprovalPanel } from "./approval-panel"

export function PropertyDetailView({ id }: { id: string }) {
  const { data: property, isLoading, error, refetch } = useProperty(id)

  if (error) {
    return (
      <ErrorState
        variant="page"
        title="Property not found"
        error={error}
        onRetry={() => void refetch()}
      />
    )
  }

  if (isLoading || !property) return <CardListSkeleton count={3} />

  const client = clientById(property.clientId)

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={property.name}
        subtitle={`${client?.name ?? "Unknown client"} · ${property.city}, ${property.country} · ${property.id}`}
      >
        <StarRating value={property.stars} showValue={false} />
        <StatusPill status={property.status} />
        <ActionButton
          variant="outline"
          size="sm"
          toastMessage="Conversation opened"
          toastDescription={`Messaging ${client?.contactPerson ?? "the client"} is stubbed in this build.`}
        >
          <MessageSquare className="size-4" />
          Chat with hotel
        </ActionButton>
      </AdminPageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <ApprovalPanel property={property} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="General information" className="lg:col-span-2">
          <DescriptionList
            columns={3}
            items={[
              { label: "Property type", value: property.type },
              { label: "Star rating", value: `${property.stars} stars` },
              { label: "Total rooms", value: property.rooms },
              { label: "Floors", value: property.floors },
              { label: "Year built", value: property.yearBuilt },
              { label: "Last renovated", value: property.lastRenovated },
              { label: "Check-in", value: property.checkIn },
              { label: "Check-out", value: property.checkOut },
              { label: "Occupancy", value: `${property.occupancy}%` },
            ]}
          />
          <div className="mt-5 space-y-3 border-t pt-5">
            <div>
              <p className="text-muted-foreground text-xs">Address</p>
              <p className="text-sm font-medium text-pretty">
                {property.address}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Description</p>
              <p className="text-sm text-pretty">{property.description}</p>
            </div>
            <DescriptionList
              columns={2}
              items={[
                { label: "Phone", value: property.phone },
                { label: "Email", value: property.email },
                { label: "Website", value: property.website },
                { label: "Emergency", value: property.emergency },
              ]}
            />
          </div>
        </SectionCard>

        <SectionCard title="Owner">
          {client ? (
            <div className="space-y-4">
              <DescriptionList
                columns={1}
                items={[
                  {
                    label: "Client",
                    value: (
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="hover:text-primary underline-offset-2 hover:underline"
                      >
                        {client.name}
                      </Link>
                    ),
                  },
                  { label: "Contact", value: client.contactPerson },
                  { label: "Email", value: client.email },
                  { label: "Phone", value: client.phone },
                  { label: "Plan", value: client.plan },
                  { label: "Joined", value: formatDate(client.joined) },
                  {
                    label: "Commission",
                    value: `${(client.commissionRate * 100).toFixed(0)}%`,
                  },
                  {
                    label: "Monthly revenue",
                    value: <Money value={client.monthlyRevenue} />,
                  },
                ]}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                render={
                  <Link href={`/admin/clients/${client.id}`}>View client</Link>
                }
              />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              This property is not linked to a client.
            </p>
          )}
        </SectionCard>
      </div>

      <SectionCard title={`Photos (${property.photos.length})`}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {property.photos.map((src, i) => (
            <div
              key={src}
              className="bg-muted relative aspect-4/3 overflow-hidden rounded-lg"
            >
              <Image
                src={src}
                alt={`${property.name} photo ${i + 1}`}
                fill
                sizes="(min-width: 640px) 25vw, 50vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title={`Room types & rates (${property.roomTypes.length})`}
        contentClassName="px-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-6">Room type</TableHead>
              <TableHead scope="col">Bed</TableHead>
              <TableHead scope="col" className="text-right">Guests</TableHead>
              <TableHead scope="col">Size</TableHead>
              <TableHead scope="col" className="text-right">Base price</TableHead>
              <TableHead scope="col" className="text-right">Units</TableHead>
              <TableHead scope="col" className="text-right">Booked</TableHead>
              <TableHead scope="col" className="pr-6">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {property.roomTypes.map((room) => (
              <TableRow key={room.id}>
                <TableCell className="max-w-72 pl-6">
                  <span className="block font-medium">{room.name}</span>
                  <span className="text-muted-foreground block text-xs text-wrap">
                    {room.description}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{room.bed}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {room.guests}
                </TableCell>
                <TableCell className="text-muted-foreground">{room.size}</TableCell>
                <TableCell className="text-right">
                  <Money value={room.basePrice} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {room.units}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {room.booked}/{room.units}
                </TableCell>
                <TableCell className="text-muted-foreground pr-6">
                  {room.view}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>

      <SectionCard
        title="Taxes & charges"
        description="Platform-level tax rules that apply to this property"
        contentClassName="px-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="pl-6">Tax / charge</TableHead>
              <TableHead scope="col">Rate</TableHead>
              <TableHead scope="col">Applies to</TableHead>
              <TableHead scope="col">Included in</TableHead>
              <TableHead scope="col">Scope</TableHead>
              <TableHead scope="col" className="pr-6">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {property.taxRules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="pl-6 font-medium">{rule.name}</TableCell>
                <TableCell className="tabular-nums">{rule.rate}</TableCell>
                <TableCell className="text-muted-foreground">
                  {rule.appliesTo}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {rule.includedIn}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {rule.scope}
                </TableCell>
                <TableCell className="pr-6">
                  <StatusPill status={rule.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  )
}
