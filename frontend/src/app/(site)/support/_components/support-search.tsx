"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { faqs } from "../_lib/faqs"

/**
 * A search box that searches.
 *
 * It used to answer every query with `toast.success("Searching help articles
 * for …")` and do nothing — over a set of answers rendered further down the
 * same page. There is no help-article store in this product and no endpoint to
 * search one, so the honest thing to search is what is actually here.
 *
 * The query goes in the URL rather than in local state, for two reasons: the
 * results are rendered by the FAQ section at the other end of the page, and a
 * link to an answer is a thing support can send somebody.
 */
const suggestions = ["Cancellation", "Payment", "Genius", "Check-in"]

function SupportSearchInner() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  /*
   * The URL is the only state.
   *
   * The box held a `useState` synced back from `?q=` by an effect, which is the
   * shape that goes wrong the moment two things can change the URL — the back
   * button and the suggestion chips both do. `key` on the input resets it from
   * the URL instead, and the value is read out of the form on submit.
   */
  const active = params.get("q")?.trim() ?? ""

  const matches = React.useMemo(() => {
    const q = active.toLowerCase()
    if (!q) return null
    return faqs.filter(
      (faq) =>
        faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q)
    ).length
  }, [active])

  function go(next: string) {
    const q = next.trim()
    // `#faq`, because the answers are at the other end of a long page and a
    // search that leaves you looking at the hero has not answered anything.
    router.replace(q ? `${pathname}?q=${encodeURIComponent(q)}#faq` : pathname, {
      scroll: false,
    })
  }

  return (
    <div className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const entered = new FormData(e.currentTarget).get("q")
          go(typeof entered === "string" ? entered : "")
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            key={active}
            name="q"
            type="search"
            defaultValue={active}
            placeholder="Search for answers, e.g. “cancel my booking”"
            className="h-11 pl-9"
            aria-label="Search the help center"
          />
          {active ? (
            <button
              type="button"
              onClick={() => go("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
        <Button type="submit" size="lg" className="h-11">
          <Search className="size-4" />
          Search
        </Button>
      </form>

      {matches !== null ? (
        <p className="text-muted-foreground text-center text-sm">
          {matches === 0 ? (
            <>
              Nothing here matches “{active}” — the support form below reaches a
              person.
            </>
          ) : (
            <>
              {matches} {matches === 1 ? "answer" : "answers"} for “{active}”
            </>
          )}
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-muted-foreground text-xs">Popular:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => go(s)}
              className="text-muted-foreground hover:text-foreground rounded-full border px-3 py-1 text-xs transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * `useSearchParams` needs a Suspense boundary above it, or the whole route
 * opts out of static rendering.
 */
export function SupportSearch() {
  return (
    <React.Suspense
      fallback={<div className="h-11 rounded-lg border" aria-hidden />}
    >
      <SupportSearchInner />
    </React.Suspense>
  )
}
