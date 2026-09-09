"use client"

import Image from "next/image"
import Link from "next/link"

import { formatDate } from "@/lib/format"
import { hotelImage } from "@/lib/images"
import { useProperty } from "@/lib/admin/api/hooks"
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
import { ApprovalPanel } from "./approval-panel"

/**
 * One listing, as the platform sees it before deciding on it.
 *
 * A long list of fields the old version showed are gone, and it is worth
 * being specific about why: the number of floors, the year built, the year
 * last renovated, a phone number, an email, a website, an emergency contact,
 * an occupancy percentage, a per-room "booked" count and a "view" — none of
 * them exists. Nothing collects any of it, so every one was a fixture
 * rendering as fact on a screen where somebody approves a business.
 *
 * The taxes table went with them, and that one was worse than invented: rule
 * #11 says nothing is added on top of a rate. A tax table on a property page
 * describes a charging model this product does not have and never applied.
 *
 * What is here is what the API knows: where it is, what it says about itself,
 * the house rules a guest agrees to, its photos with their moderation state,
 * and how far it is from being publishable.
 */
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

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={property.name}
        subtitle={`${property.orgName ?? "Unassigned"} · ${property.city}, ${property.country}`}
      >
        {property.stars === null ? null : (
          <StarRating value={property.stars} showValue={false} />
        )}
        <StatusPill status={property.status} />
        {property.orgId ? (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/admin/clients/${property.orgId}`}>View client</Link>}
          />
        ) : null}
      </AdminPageHeader>

      <div className="grid gap-4">
        <ApprovalPanel property={property} />
      </div>

      <SectionCard title="What it says about itself">
        <DescriptionList
          columns={3}
          items={[
            { label: "Type", value: property.type },
            {
              label: "Stars",
              value: property.stars === null ? "Unrated" : `${property.stars}`,
            },
            { label: "Timezone", value: property.timezone },
            { label: "Check-in", value: property.checkInTime },
            { label: "Check-out", value: property.checkOutTime },
            { label: "Listed", value: formatDate(property.createdAt) },
            { label: "Rooms", value: String(property.counts.rooms) },
            { label: "Rate plans", value: String(property.counts.ratePlans) },
            { label: "Photos", value: String(property.counts.photos) },
          ]}
        />
        <div className="mt-5 space-y-3 border-t pt-5">
          <div>
            <p className="text-muted-foreground text-xs">Address</p>
            <p className="text-sm font-medium text-pretty">{property.address}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Description</p>
            <p className="text-sm text-pretty">
              {property.description || (
                <span className="text-muted-foreground">
                  Nothing written yet — a listing cannot be published without one.
                </span>
              )}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="House rules"
        description="What a guest agrees to at booking. Cancellation is not here — it belongs to a rate plan (rule #1)."
      >
        <DescriptionList
          columns={2}
          items={[
            { label: "Payment", value: property.policyPayment || "Not set" },
            { label: "Pets", value: property.policyPets || "Not set" },
            { label: "Smoking", value: property.policySmoking || "Not set" },
            { label: "Children & cots", value: property.policyChildren || "Not set" },
          ]}
        />
      </SectionCard>

      <SectionCard
        title={`Photos (${property.photos.length})`}
        description="A new photo is pending until the platform looks at it. Approving the listing approves its photos."
      >
        {property.photos.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No photos uploaded. Five is the minimum before this can be published.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {property.photos.map((photo, i) => (
              <figure key={photo.id} className="space-y-1.5">
                <div className="bg-muted relative aspect-4/3 overflow-hidden rounded-lg">
                  <Image
                    /*
                     * The stored URL when there is one, a placeholder when
                     * there is not — the fake storage adapter does not hand
                     * back a real address, and a broken image tells an
                     * operator nothing about the listing.
                     */
                    src={photo.url ?? hotelImage(photo.seed, 400, 300)}
                    alt={photo.caption || `${property.name} photo ${i + 1}`}
                    fill
                    sizes="(min-width: 640px) 25vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <figcaption className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground truncate text-xs">
                    {photo.caption || photo.category}
                  </span>
                  {photo.status === "approved" ? null : (
                    <Badge variant="outline" className="shrink-0">
                      {photo.status}
                    </Badge>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
