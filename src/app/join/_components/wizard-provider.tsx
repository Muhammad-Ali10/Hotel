"use client"

import * as React from "react"

import { initialData, type RegistrationData } from "../_lib/types"

const STORAGE_KEY = "stayora-join-draft"

// A module-level external store, read through useSyncExternalStore. Registration
// spans ~30 routes, so a refresh mid-flow shouldn't wipe progress — but the
// server render and first client render must still match. getServerSnapshot
// pins both to the deterministic seed; the persisted draft is merged in on the
// post-hydration re-render, so there's no mismatch and no setState-in-effect.
let state: RegistrationData = readInitial()
const listeners = new Set<() => void>()

function readInitial(): RegistrationData {
  if (typeof window === "undefined") return initialData
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw
      ? { ...initialData, ...(JSON.parse(raw) as Partial<RegistrationData>) }
      : initialData
  } catch {
    return initialData
  }
}

function persist() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage full / unavailable — the flow still works in-memory
  }
}

function setWizardState(next: RegistrationData) {
  state = next
  persist()
  listeners.forEach((notify) => notify())
}

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

export function useWizard() {
  const data = React.useSyncExternalStore(
    subscribe,
    () => state,
    () => initialData,
  )

  const update = React.useCallback((patch: Partial<RegistrationData>) => {
    setWizardState({ ...state, ...patch })
  }, [])

  const reset = React.useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    setWizardState(initialData)
  }, [])

  return { data, update, reset }
}

/** Kept as a passthrough so the layout has a stable mount point for the flow. */
export function WizardProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
