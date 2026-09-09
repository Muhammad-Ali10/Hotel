import { ApiError, errorFromResponse, networkError } from "./errors"

/**
 * The single door to the Nest API.
 *
 * Everything the browser asks of the backend goes through `api()`. One place
 * for the base URL, the session cookie, the error shape and the JSON handling
 * means there is one place to fix when any of them turns out to be wrong —
 * which, on a wire nothing has ever crossed, is worth assuming.
 */

/*
 * Read STATICALLY, never as `process.env[name]`.
 *
 * Next replaces this exact expression with a literal at build time; a dynamic
 * lookup is not replaced and arrives as `undefined` in the browser. The value
 * is therefore FROZEN at build — a container promoted from staging to
 * production keeps whatever it was built with.
 */
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"

export type ApiRequest = {
  // PUT is here for the routes where the client asserts a STATE rather
  // than announcing an event — saving a favourite, replacing a price grid.
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
  /** Serialised as JSON. Skipped entirely when absent, so GETs stay bodyless. */
  body?: unknown
  /** Appended as a query string; `undefined` and `null` entries are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  signal?: AbortSignal
}

/**
 * One request.
 *
 * Always `credentials: "include"`: the session is an httpOnly cookie the
 * browser will not attach to a cross-origin request unless asked. The API and
 * the site are different origins in every environment — different ports in
 * development, most likely different subdomains in production — so this is not
 * an edge case, it is every authenticated request there is.
 */
export async function api<T>(path: string, options: ApiRequest = {}): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null || value === "") continue
    url.searchParams.set(key, String(value))
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    })
  } catch (cause) {
    // A rejected `fetch` is the request never arriving — DNS, CORS, offline.
    // The API cannot be blamed for a message it never received.
    throw networkError(cause)
  }

  if (!response.ok) throw await errorFromResponse(response)

  /*
   * 204, or any other body-less success. `response.json()` would throw.
   *
   * `null`, not `undefined`. Nest serialises a handler that returns `null` as
   * an EMPTY BODY, and several endpoints legitimately do — `/partner/payouts/
   * account` answers `null` for a partner who has not set one up, and its DTO
   * is typed `… | null` to say so. Returning `undefined` here broke that
   * contract twice over: the value did not match the type, and React Query
   * rejects `undefined` outright ("Query data cannot be undefined"), so the
   * screen threw instead of rendering its empty state.
   *
   * A genuine 204 — a DELETE typed `void` — is unaffected: nothing reads it.
   */
  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return null as T
  }

  try {
    return (await response.json()) as T
  } catch (cause) {
    throw new ApiError({
      statusCode: response.status,
      code: "malformed_response",
      message: "The server sent something we could not read.",
      extras: { cause: String(cause) },
    })
  }
}

/**
 * A stable, opaque id for this browser, used only to group searches (rule #68).
 *
 * `sessionStorage`, so it dies with the tab — enough to tell one visitor's five
 * searches from five visitors' one, and not enough to follow anybody across
 * visits. Never sent anywhere but the search endpoint, where it is hashed
 * before it reaches a column.
 */
export function browsingSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const KEY = "stayora.sid"
    let id = window.sessionStorage.getItem(KEY)
    if (!id) {
      id = crypto.randomUUID()
      window.sessionStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // Private mode, or storage disabled. Analytics is not worth an exception.
    return undefined
  }
}

/**
 * A key that makes retrying a booking safe (rule #23).
 *
 * The API refuses anything under eight characters, and a key generated fresh
 * per ATTEMPT would defeat the whole mechanism — the caller must hold one key
 * for as long as it is retrying the same booking.
 */
export function idempotencyKey(): string {
  return `stayora-${crypto.randomUUID()}`
}

/* ------------------------------------------------------------- pagination -- */

export type Page<T> = { items: T[]; nextCursor: string | null }

/**
 * Every page of a keyset-paginated list, followed to the end.
 *
 * The screens that call this do not want a page — they want a total, a
 * calendar, a count per property. Handing them page one and letting them
 * aggregate it is how a partner with 300 reservations gets told they have 50.
 *
 * `maxPages` is a real bound, not decoration: an unbounded follow loop against
 * a list that grows while it is read does not terminate. It is deliberately
 * generous, and `complete` says whether it was hit, so a caller can tell
 * "that is all of them" from "that is as far as I looked". Nothing here is
 * allowed to be quietly partial again — that was the bug.
 *
 * This is an INTERIM. Counting rows in the browser to draw a stat card is the
 * wrong shape at any page size; those views want server-side aggregates, and
 * the analytics module is where they belong. What this fixes today is the
 * silent truncation, not the architecture.
 */
export async function allPages<T>(
  path: string,
  options: ApiRequest & { maxPages?: number } = {}
): Promise<{ items: T[]; complete: boolean }> {
  const maxPages = options.maxPages ?? 20
  const items: T[] = []
  let cursor: string | null = null

  for (let page = 0; page < maxPages; page += 1) {
    const query = { ...options.query, limit: 100, cursor: cursor ?? undefined }
    const result: Page<T> = await api<Page<T>>(path, { ...options, query })
    items.push(...result.items)
    cursor = result.nextCursor
    if (!cursor) return { items, complete: true }
  }

  return { items, complete: false }
}
