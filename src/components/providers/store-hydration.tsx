"use client"

import * as React from "react"

import { useStore } from "@/store"

/**
 * Merges the persisted demo state in after mount.
 *
 * The store is created with `skipHydration`, so the server render and the first
 * client render both come from the deterministic seed and match exactly. Only
 * once React has hydrated do we pull localStorage in, which is why a booking
 * made in a previous session survives a refresh without tripping a hydration
 * mismatch.
 */
export function StoreHydration() {
  React.useEffect(() => {
    void useStore.persist.rehydrate()
  }, [])

  return null
}

/**
 * True once the persisted state has been merged. Use it to hold back UI whose
 * server-rendered markup would visibly flip after rehydration (a favourite
 * heart, an unread badge), so the change lands as an entrance rather than a
 * flicker.
 */
export function useHydrated() {
  return React.useSyncExternalStore(
    (onChange) => useStore.persist.onFinishHydration(onChange),
    () => useStore.persist.hasHydrated(),
    // the server never has persisted state
    () => false
  )
}
