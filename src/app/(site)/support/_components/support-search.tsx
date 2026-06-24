"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const suggestions = ["Cancellation policy", "Refunds", "Reward points", "Check-in time"]

export function SupportSearch() {
  const [query, setQuery] = React.useState("")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) {
      toast.info("Type a question to search our help center.")
      return
    }
    toast.success(`Searching help articles for “${q}”…`)
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for answers, e.g. “cancel my booking”"
            className="h-11 pl-9"
            aria-label="Search the help center"
          />
        </div>
        <Button type="submit" size="lg" className="h-11">
          <Search className="size-4" />
          Search
        </Button>
      </form>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-muted-foreground text-xs">Popular:</span>
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setQuery(s)}
            className="text-muted-foreground hover:text-foreground rounded-full border px-3 py-1 text-xs transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
