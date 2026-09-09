"use client"

import * as React from "react"
import { MessageSquare, Search } from "lucide-react"

import type { ReviewStatus } from "@/types"
import { avatarImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import { formatRelativeTime } from "@/lib/format"
import { reviewStatusLabel } from "@/lib/labels"
import type { ReviewDto } from "@/lib/api/endpoints"
import { usePartnerProperties, usePartnerReviews } from "@/lib/api/hooks"
import { ReviewStatusBadge } from "@/components/shared/status-badge"
import { StarRating } from "@/components/marketplace/star-rating"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReviewActions } from "./review-actions"

const statusTabs: (ReviewStatus | "all")[] = ["all", "published", "pending", "flagged", "rejected"]

const ratingOptions = [
  { value: "all", label: "All Ratings" },
  { value: "5", label: "5 Stars" },
  { value: "4", label: "4 Stars" },
  { value: "3", label: "3 Stars" },
  { value: "2", label: "2 Stars" },
  { value: "1", label: "1 Star" },
]

/**
 * The partner's moderation queue, over the same reviews the public pages show.
 * Rejecting one here removes it from the hotel page; replying to one puts the
 * response under the review for every guest to see.
 */
export function ReviewsList() {
  const [tab, setTab] = React.useState<ReviewStatus | "all">("all")
  const [query, setQuery] = React.useState("")
  const [rating, setRating] = React.useState("all")
  const [property, setProperty] = React.useState("all")

  /*
   * The STATUS filter goes to the server; the rest stay here.
   *
   * Status is what the tabs are, and it is what the counts are grouped by —
   * asking the server means the tab shows the whole set rather than whatever
   * fitted on this page. Text, rating and property are cheap to narrow locally
   * and the API takes none of them.
   */
  const { data, isPending, error } = usePartnerReviews(tab)
  const { data: properties } = usePartnerProperties()

  const reviews = data?.items ?? []

  /*
   * Counts from the SERVER, across the whole set.
   *
   * Counting `reviews` would count the current page, so a tab would say "3"
   * beside a queue of thirty.
   */
  const counts: Record<string, number> = {
    ...(data?.counts ?? {}),
    all: Object.values(data?.counts ?? {}).reduce((sum, n) => sum + n, 0),
  }

  const propertyItems = [
    { value: "all", label: "All Properties" },
    ...(properties ?? []).map((p) => ({ value: p.id, label: p.name })),
  ]

  const filtered = reviews.filter((r) => {
    const q = query.trim().toLowerCase()
    const matchesQuery =
      !q ||
      r.author.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.body.toLowerCase().includes(q)
    const matchesRating = rating === "all" || r.rating === Number(rating)
    const matchesProperty = property === "all" || r.propertyId === property
    return matchesQuery && matchesRating && matchesProperty
  })

  if (isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading reviews">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-muted h-28 animate-pulse rounded-xl" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm">
        {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {statusTabs.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setTab(s)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              tab === s
                ? "bg-primary text-primary-foreground border-transparent"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s === "all" ? "All" : reviewStatusLabel[s]}
            <span className="ml-1.5 opacity-70">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guest, title, review text…"
            className="h-9 pl-8"
          />
        </div>
        <Select items={ratingOptions} value={rating} onValueChange={(v) => setRating(String(v))}>
          <SelectTrigger className="h-9 w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ratingOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select items={propertyItems} value={property} onValueChange={(v) => setProperty(String(v))}>
          <SelectTrigger className="h-9 w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {propertyItems.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-4">
        {filtered.map((review) => (
          <ReviewRow
            key={review.id}
            review={review}
            hotelName={
              (properties ?? []).find((p) => p.id === review.propertyId)?.name ?? ""
            }
          />
        ))}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="text-muted-foreground py-10 text-center text-sm">
              No reviews match these filters.
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function ReviewRow({ review, hotelName }: { review: ReviewDto; hotelName: string }) {
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage src={avatarImage(review.authorSeed, 80)} alt={review.author} />
              <AvatarFallback>{review.author.slice(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{review.author}</span>
                <ReviewStatusBadge status={review.status as ReviewStatus} />
                {/*
                  `verified` is the API's own answer to "did they actually
                  stay" — the booking id itself is never exposed publicly.
                */}
                {review.verified ? <Badge variant="outline">Verified stay</Badge> : null}
              </div>
              <p className="text-muted-foreground text-xs">
                {hotelName} · {review.roomName} · {formatRelativeTime(review.date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <StarRating rating={review.rating} size="size-3.5" />
            <span className="text-sm font-medium">{review.rating}</span>
          </div>
        </div>

        <div className="space-y-1">
          <p className="font-medium">{review.title}</p>
          <p className="text-muted-foreground text-sm text-pretty">{review.body}</p>
        </div>

        {review.response ? (
          <div className="bg-muted/40 border-l-primary/40 space-y-1 rounded-lg border-l-2 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <MessageSquare className="size-3.5" />
              Your response
            </p>
            <p className="text-muted-foreground text-sm">{review.response.text}</p>
            <p className="text-muted-foreground text-xs">{review.response.at ? formatDate(review.response.at) : null}</p>
          </div>
        ) : null}

        <ReviewActions review={review} />
      </CardContent>
    </Card>
  )
}
