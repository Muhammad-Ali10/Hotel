"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"

import { useFavorites } from "@/lib/api/hooks"
import { useSession } from "@/lib/api/hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FavoriteCard } from "./favorite-card"
import { EmptyFavorites } from "./empty-favorites"

/**
 * The guest's saved list, from the server (rule #96).
 *
 * It used to read a zustand store filled from a fixture, which meant a saved
 * list lived in one browser tab and nowhere else — sign in on a phone and it
 * was empty. Before that it rendered `hotels.slice(0, 6)`: six properties
 * nobody had picked, above a stat tile that claimed four.
 */
export function FavoritesGrid() {
  const session = useSession()
  const { data, error } = useFavorites()

  /*
   * Both queries, together.
   *
   * Guarding on the favourites query alone would flash "sign in" for one frame
   * while the session is still resolving — to somebody who IS signed in.
   */
  const isLoading = session.isLoading || (Boolean(session.data) && !data && !error)
  const signedOut = !session.isLoading && !session.data

  const items = data?.items ?? []

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
          Saved Hotels
        </h1>
        <p className="text-muted-foreground text-sm">
          {isLoading
            ? "Loading…"
            : `${items.length} ${items.length === 1 ? "property" : "properties"}`}
        </p>
      </div>

      {/*
        Signing in is the answer to an empty list here, not "save something".
        A saved list belongs to a person, so a visitor has no list rather than
        an empty one — and telling them to browse would be the wrong advice.
      */}
      {signedOut ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <p className="font-heading text-lg font-semibold">
              Sign in to see what you saved
            </p>
            <p className="text-muted-foreground max-w-sm text-sm">
              Your saved hotels follow your account, so they are there on every
              device you sign in on.
            </p>
            <Button render={<Link href="/login">Sign in</Link>} />
          </CardContent>
        </Card>
      ) : error ? (
        <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {error.message}
            {error.isRetryable ? " Try again in a moment." : null}
          </span>
        </div>
      ) : isLoading ? (
        <div
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Loading saved hotels"
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-muted h-72 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <FavoriteCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <EmptyFavorites />
      )}
    </div>
  )
}
