"use client"

import * as React from "react"
import { Lightbulb, Search, Star } from "lucide-react"

import { reviews, reviewStats } from "@/data/extranet"
import { avatarImage } from "@/lib/images"
import { cn } from "@/lib/utils"
import { StatusPill } from "@/components/extranet/shared"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

const tabs = [
  { key: "All", count: reviewStats.total },
  { key: "Approved", count: reviewStats.approved },
  { key: "Pending", count: reviewStats.pending },
  { key: "Flagged", count: reviewStats.flagged },
  { key: "Rejected", count: reviewStats.rejected },
] as const

const ratingOptions = [
  { value: "all", label: "All Ratings" },
  { value: "5", label: "5 Stars" },
  { value: "4", label: "4 Stars" },
  { value: "3", label: "3 Stars" },
  { value: "2", label: "2 Stars" },
  { value: "1", label: "1 Star" },
]

const properties = Array.from(new Set(reviews.map((r) => r.property)))

function timeAgo(days: number) {
  if (days <= 0) return "Today"
  if (days === 1) return "Yesterday"
  return `${days} days ago`
}

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "size-3.5",
            i < rating
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted"
          )}
        />
      ))}
    </div>
  )
}

export function ReviewsList() {
  const [tab, setTab] = React.useState<(typeof tabs)[number]["key"]>("All")
  const [rating, setRating] = React.useState("all")
  const [property, setProperty] = React.useState("all")
  const [query, setQuery] = React.useState("")

  const list = reviews.filter((r) => {
    const matchesTab = tab === "All" || r.status === tab
    const matchesRating = rating === "all" || r.rating === Number(rating)
    const matchesProperty = property === "all" || r.property === property
    const q = query.trim().toLowerCase()
    const matchesQuery =
      !q ||
      r.guest.toLowerCase().includes(q) ||
      r.title.toLowerCase().includes(q) ||
      r.body.toLowerCase().includes(q) ||
      r.property.toLowerCase().includes(q)
    return matchesTab && matchesRating && matchesProperty && matchesQuery
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {t.key} ({t.count})
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={rating} onValueChange={(v) => setRating(String(v))}>
          <SelectTrigger className="w-full sm:w-40">
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
        <Select value={property} onValueChange={(v) => setProperty(String(v))}>
          <SelectTrigger className="w-full sm:w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative sm:ml-auto sm:w-72">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reviews… (⌘K)"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        Showing {list.length} reviews
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {list.map((r) => (
          <Card key={r.id}>
            <CardContent className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <Avatar>
                    <AvatarImage src={avatarImage(r.seed)} alt={r.guest} />
                    <AvatarFallback>{r.guest[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{r.guest}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Stars rating={r.rating} />
                      <span className="text-muted-foreground text-xs">
                        {timeAgo(r.daysAgo)}
                      </span>
                    </div>
                  </div>
                </div>
                <StatusPill status={r.status} />
              </div>

              <p className="text-muted-foreground text-xs">
                {r.property} · {r.room} · {r.bookingId}
              </p>

              <div className="space-y-1">
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {r.body}
                </p>
              </div>

              {r.response ? (
                <div className="bg-muted/50 space-y-1 rounded-lg p-3">
                  <p className="text-xs font-medium">Your response</p>
                  <p className="text-muted-foreground text-sm">{r.response}</p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <ReviewActions guest={r.guest} status={r.status} />
                  {r.status === "Approved" ? (
                    <span className="text-muted-foreground text-xs">
                      No response yet
                    </span>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {list.length === 0 ? (
          <p className="text-muted-foreground col-span-full py-10 text-center text-sm">
            No reviews match your filters.
          </p>
        ) : null}
      </div>

      <Card className="bg-muted/40">
        <CardContent className="flex items-start gap-3">
          <span className="bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Lightbulb className="size-4" />
          </span>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              Pro tip: Respond to reviews within 48 hours
            </p>
            <p className="text-muted-foreground text-sm">
              Properties that respond to guest reviews within 48 hours see a 23%
              higher booking conversion rate. Personalized responses that address
              specific guest experiences build trust with future travelers
              browsing your reviews.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
