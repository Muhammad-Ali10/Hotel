"use client"

import Link from "next/link"

import { cn } from "@/lib/utils"
import { discountTier, propertyById, propertyName } from "@/data/admin"
import { usePromotionRankings } from "@/lib/admin/api/hooks"
import { Money, SectionCard, StarRating } from "@/components/admin/shared"
import { DataTableSkeleton } from "@/components/shared/data-table"
import { EmptyState, ErrorState } from "@/components/shared/states"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const TIER_TEXT = {
  "High Discount": "text-emerald-700 dark:text-emerald-400",
  "Moderate Discount": "text-amber-700 dark:text-amber-400",
  "Low Discount": "text-muted-foreground",
} as const

export function DiscountRankings() {
  // Goes through the API like every other screen, so pausing a campaign
  // removes it from the ranking and the loading/error states are real.
  const { data, isLoading, error, refetch } = usePromotionRankings()

  if (error) {
    return (
      <SectionCard title="Discount rankings" contentClassName="px-0">
        <ErrorState error={error} onRetry={() => void refetch()} />
      </SectionCard>
    )
  }

  if (isLoading || !data) {
    return (
      <SectionCard title="Discount rankings" contentClassName="px-0">
        <DataTableSkeleton columns={7} rows={6} />
      </SectionCard>
    )
  }

  if (data.length === 0) {
    return (
      <SectionCard title="Discount rankings" contentClassName="px-0">
        <EmptyState
          title="No active discounts"
          description="Rankings appear once campaigns go live."
        />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="Discount rankings"
      description="Live and scheduled campaigns ranked by discount depth"
      contentClassName="px-0"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="pl-6 w-16">Rank</TableHead>
            <TableHead scope="col">Hotel</TableHead>
            <TableHead scope="col">City</TableHead>
            <TableHead scope="col">Rating</TableHead>
            <TableHead scope="col" className="text-right">Discount</TableHead>
            <TableHead scope="col">Tier</TableHead>
            <TableHead scope="col" className="pr-6 text-right">Price</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const property = propertyById(row.propertyId)
            const tier = discountTier(row.discount)
            return (
              <TableRow key={`${row.rank}-${row.propertyId}`}>
                <TableCell className="pl-6 font-medium tabular-nums">
                  {row.rank}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/properties/${row.propertyId}`}
                    className="hover:text-primary font-medium underline-offset-2 hover:underline"
                  >
                    {propertyName(row.propertyId)}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {property?.city ?? "—"}
                </TableCell>
                <TableCell>
                  <StarRating value={row.rating} />
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium tabular-nums",
                    TIER_TEXT[tier]
                  )}
                >
                  {row.discount}%
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={TIER_TEXT[tier]}>
                    {tier}
                  </Badge>
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <span className="font-medium">
                    <Money value={row.discountedPrice} />
                  </span>
                  <span className="text-muted-foreground ml-2 text-xs line-through">
                    <Money value={row.originalPrice} />
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </SectionCard>
  )
}
