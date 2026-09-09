"use client"

import * as React from "react"

/* ============================================================================
 * The three screens before there is an account.
 *
 * Email, then name and phone, then a password — and only on the third does an
 * account actually get created. The first two answers have to survive the walk
 * between screens, and there is nowhere on the server to put them yet.
 *
 * So: memory, and only memory. NOT `localStorage`, which is where the rest of
 * this wizard used to live — a half-typed signup left on a shared machine is
 * somebody else's to find, and a password never touches this store at all. It
 * is read straight out of the field on the screen that submits it.
 *
 * The cost is that a refresh during these three screens starts them again,
 * which is what every signup form does.
 * ========================================================================== */

export type AccountDraft = {
  email: string
  firstName: string
  lastName: string
  phone: string
}

const empty: AccountDraft = { email: "", firstName: "", lastName: "", phone: "" }

let state: AccountDraft = empty
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function setAccountDraft(patch: Partial<AccountDraft>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

/** Called once the account exists, so nothing is left behind in the tab. */
export function clearAccountDraft() {
  state = empty
  listeners.forEach((listener) => listener())
}

export function useAccountDraft() {
  /*
   * The same snapshot on the server as on the first client render, so
   * hydration matches. There is nothing to restore — an in-memory store starts
   * empty on both sides — which is why this needs no merge-after-mount dance.
   */
  const data = React.useSyncExternalStore(
    subscribe,
    () => state,
    () => empty
  )
  return { data, update: setAccountDraft, clear: clearAccountDraft }
}
