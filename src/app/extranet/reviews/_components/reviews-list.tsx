"use client"

import * as React from "react"
import { MessageSquare, Search } from "lucide-react"

import type { Review, ReviewStatus } from "@/types"
import { avatarImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/format"
import { formatRelativeTime } from "@/lib/format"
import { reviewStatusLabel } from "@/lib/labels"
import { usePartnerHotels, usePartnerReviews } from "@/store/selectors"
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
  const reviews = usePartnerReviews()
  const hotels = usePartnerHotels()

  const [tab, setTab] = React.useState<ReviewStatus | "all">("all")
  const [query, setQuery] = React.useState("")
  const [rating, setRating] = React.useState("all")
  const [property, setProperty] = React.useState("all")

  const counts = React.useMemo(() => {
    const out: Record<string, number> = { all: reviews.length }
    for (const s of statusTabs) {
      if (s === "all") continue
      out[s] = reviews.filter((r) => r.status === s).length
    }
    return out
  }, [reviews])

  const propertyItems = [
    { value: "all", label: "All Properties" },
    ...hotels.map((h) => ({ value: h.id, label: h.name })),
  ]

  const filtered = reviews.filter((r) => {
    const q = query.trim().toLowerCase()
    const matchesQuery =
      !q ||
      r.author.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.body.toLowerCase().includes(q)
    const matchesTab = tab === "all" || r.status === tab
    const matchesRating = rating === "all" || r.rating === Number(rating)
    const matchesProperty = property === "all" || r.hotelId === property
    return matchesQuery && matchesTab && matchesRating && matchesProperty
  })

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
            hotelName={hotels.find((h) => h.id === review.hotelId)?.name ?? review.hotelId}
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

function ReviewRow({ review, hotelName }: { review: Review; hotelName: string }) {
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
                <ReviewStatusBadge status={review.status} />
                {review.bookingId ? <Badge variant="outline">Verified stay</Badge> : null}
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
            <p className="text-muted-foreground text-xs">{formatDate(review.response.date)}</p>
          </div>
        ) : null}

        <ReviewActions review={review} />
      </CardContent>
    </Card>
  )
}
