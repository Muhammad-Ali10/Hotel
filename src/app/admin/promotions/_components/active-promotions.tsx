"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarRange, FileText } from "lucide-react"

import { cn } from "@/lib/utils"
import type { DiscountTier, Promotion } from "@/lib/admin/types"
import {
  clientName,
  discountTier,
  promotionCities,
  propertyById,
  propertyName,
} from "@/data/admin"
import { usePromotions, useSetPromotionStatus } from "@/lib/admin/api/hooks"
import { useCan } from "@/components/admin/role-provider"
import { Money, StarRating, StatusPill } from "@/components/admin/shared"
import { CardListSkeleton } from "@/components/shared/data-table"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Discount tiers keep the Figma's green/amber/red banding but express it with
 * the project's status tokens rather than hardcoded colours.
 */
const TIER_STYLES: Record<DiscountTier, { ring: string; text: string }> = {
  "High Discount": {
    ring: "border-emerald-500/40 bg-emerald-500/5",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  "Moderate Discount": {
    ring: "border-amber-500/40 bg-amber-500/5",
    text: "text-amber-700 dark:text-amber-400",
  },
  "Low Discount": {
    ring: "border-border bg-muted/40",
    text: "text-muted-foreground",
  },
}

export function ActivePromotions() {
  const can = useCan()
  const [city, setCity] = React.useState("All")
  const { data, isLoading, error, refetch } = usePromotions(city)
  const setStatus = useSetPromotionStatus()
  const [hotelList, setHotelList] = React.useState<Promotion | null>(null)
  const canManage = can.do("promotion.manage")

  const cities = ["All", ...promotionCities]

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Filter by city"
        className="flex flex-wrap gap-1.5"
      >
        {cities.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={city === option}
            onClick={() => setCity(option)}
            className={cn(
              "focus-visible:ring-ring/50 rounded-full border px-3 py-1 text-sm transition-colors outline-none focus-visible:ring-3",
              city === option
                ? "bg-primary text-primary-foreground border-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {option}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} variant="page" />
      ) : isLoading || !data ? (
        <CardListSkeleton count={3} />
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              filtered={city !== "All"}
              onClearFilters={() => setCity("All")}
              title="No promotions"
              description="Campaigns created by clients or the platform appear here."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((promotion) => {
            const tier = discountTier(promotion.discount)
            const style = TIER_STYLES[tier]
            return (
              <Card
                key={promotion.id}
                className={cn("border", style.ring)}
              >
                <CardContent className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{promotion.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {promotion.kind} · {promotion.city}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0", style.text)}>
                      {tier}
                    </Badge>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        "font-heading text-3xl font-semibold tabular-nums",
                        style.text
                      )}
                    >
                      {promotion.discount}%
                    </span>
                    <span className="text-muted-foreground text-xs">
                      off regular rates · min stay {promotion.minStay}{" "}
                      {promotion.minStay === 1 ? "night" : "nights"}
                    </span>
                  </div>

                  <dl className="space-y-1.5 text-xs">
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground flex shrink-0 items-center gap-1">
                        <FileText aria-hidden className="size-3.5" />
                        Applies to
                      </dt>
                      <dd className="min-w-0 flex-1 truncate">
                        {promotion.propertyIds.map(propertyName).join(", ")}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground flex shrink-0 items-center gap-1">
                        <CalendarRange aria-hidden className="size-3.5" />
                        Travel window
                      </dt>
                      <dd className="min-w-0 flex-1 truncate">
                        {promotion.travelWindow}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                    <div className="flex items-center gap-2">
                      <StatusPill status={promotion.status} />
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {promotion.bookings} bookings
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHotelList(promotion)}
                      >
                        Hotels
                      </Button>
                      {canManage && promotion.status === "Active" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={setStatus.isPending}
                          onClick={() =>
                            setStatus.mutate({
                              id: promotion.id,
                              status: "Paused",
                            })
                          }
                        >
                          Pause
                        </Button>
                      ) : null}
                      {canManage && promotion.status === "Paused" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={setStatus.isPending}
                          onClick={() =>
                            setStatus.mutate({
                              id: promotion.id,
                              status: "Active",
                            })
                          }
                        >
                          Resume
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <Dialog
        open={hotelList !== null}
        onOpenChange={(open) => {
          if (!open) setHotelList(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{hotelList?.name}</DialogTitle>
            <DialogDescription>
              {hotelList?.discount}% off —{" "}
              {hotelList?.propertyIds.length}{" "}
              {hotelList?.propertyIds.length === 1 ? "hotel" : "hotels"} included
            </DialogDescription>
          </DialogHeader>

          <ul className="divide-y">
            {hotelList?.propertyIds.map((propertyId) => {
              const property = propertyById(propertyId)
              if (!property) return null
              const discounted = Math.round(
                property.adr * (1 - hotelList.discount / 100)
              )
              return (
                <li
                  key={propertyId}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/admin/properties/${propertyId}`}
                      className="hover:text-primary block truncate font-medium underline-offset-2 hover:underline"
                    >
                      {property.name}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      {property.city} · {clientName(property.clientId)}
                    </p>
                    <StarRating value={property.stars} showValue={false} />
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium">
                      <Money value={discounted} />
                    </p>
                    <p className="text-muted-foreground text-xs line-through">
                      <Money value={property.adr} />
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>

          <DialogFooter>
            <Button variant="outline" onClick={() => setHotelList(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
