"use client"

import * as React from "react"

import type { PartnerProperty } from "@/lib/api/endpoints"
import { usePartnerProperties } from "@/lib/api/hooks"

/**
 * Which property the extranet is currently about.
 *
 * Almost every screen here answers a question about ONE property — this
 * calendar, these photos, this score — so the choice has to live above them
 * all. It used to be a constant (`PARTNER_ORG.activeHotelId = "the-ritz-carlton"`)
 * and the topbar's switcher only changed a label: picking a different hotel
 * changed nothing on any screen.
 *
 * The selection is kept in `localStorage` rather than in the URL. A partner
 * works on one property for an afternoon and moves between fifteen screens;
 * threading `?property=` through every link would be the same choice repeated
 * fifteen times, and one missed link would silently switch them back.
 */

const STORAGE_KEY = "stayora.extranet.property"

const choiceListeners = new Set<() => void>()

function subscribeToChoice(listener: () => void) {
  choiceListeners.add(listener)
  // Another tab switching property should move this one too.
  window.addEventListener("storage", listener)
  return () => {
    choiceListeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

function readChoice(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

type ActivePropertyValue = {
  properties: PartnerProperty[]
  active: PartnerProperty | null
  setActive: (propertyId: string) => void
  isPending: boolean
  /** True for a partner whose account has no properties yet. */
  isEmpty: boolean
}

const ActivePropertyContext = React.createContext<ActivePropertyValue | null>(null)

export function ActivePropertyProvider({ children }: { children: React.ReactNode }) {
  const { data, isPending } = usePartnerProperties()
  const properties = React.useMemo(() => data ?? [], [data])

  /*
   * Read through `useSyncExternalStore`, not through an effect.
   *
   * `localStorage` does not exist while rendering on the server, so the value
   * has two snapshots — one for the server (nothing chosen) and one for the
   * client. This is the hook built for exactly that: React uses the server
   * snapshot to hydrate and then re-renders with the real one, instead of an
   * effect calling `setState` and cascading a render on every mount.
   */
  const chosenId = React.useSyncExternalStore(
    subscribeToChoice,
    readChoice,
    () => null
  )

  const setActive = React.useCallback((propertyId: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, propertyId)
    } catch {
      // Storage blocked: the choice cannot be remembered, but the app works.
    }
    // `storage` only fires in OTHER tabs, so this tab is told by hand.
    choiceListeners.forEach((listener) => listener())
  }, [])

  /*
   * The stored id is CHECKED against what the partner may actually see.
   *
   * A property can be sold, suspended or moved out of a member's scope while
   * their browser still remembers it — falling back to the first one is the
   * safe direction, and it is what stops a stale id producing an empty screen
   * with no explanation.
   */
  const active =
    properties.find((p) => p.id === chosenId) ?? properties[0] ?? null

  const value = React.useMemo<ActivePropertyValue>(
    () => ({
      properties,
      active,
      setActive,
      isPending,
      isEmpty: !isPending && properties.length === 0,
    }),
    [properties, active, setActive, isPending]
  )

  return (
    <ActivePropertyContext.Provider value={value}>{children}</ActivePropertyContext.Provider>
  )
}

export function useActiveProperty(): ActivePropertyValue {
  const value = React.useContext(ActivePropertyContext)
  if (!value) {
    throw new Error("useActiveProperty must be used inside the extranet layout")
  }
  return value
}
