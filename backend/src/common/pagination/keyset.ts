import { Buffer } from "node:buffer"

/* ============================================================================
 * Keyset pagination, in one place.
 *
 * `OFFSET 10000` makes Postgres walk and discard ten thousand rows to serve
 * page 101. A keyset carries the last row's sort value instead, so every page
 * costs the same as the first.
 *
 * The id is not decoration. Without it, rows sharing a sort value straddle the
 * page boundary: `WHERE check_in > '2027-03-08'` skips every other booking
 * that also checks in that day. On a DATE column those ties are not unlikely —
 * they are the normal case, which is how a partner loses arrivals from a list
 * that looks complete.
 *
 * This was written three times before it lived anywhere: once in the catalogue
 * search, once in the admin reservation search, and once more the moment the
 * guest and partner lists needed it. Three copies is three chances to forget
 * the tiebreak in one of them.
 * ========================================================================== */

export type Cursor = { value: string; id: string }

/** Opaque on purpose — a cursor is ours to change, not a client's to build. */
export function encodeCursor(value: string, id: string): string {
  return Buffer.from(`${value}\0${id}`, "utf8").toString("base64url")
}

export function decodeCursor(cursor: string | undefined | null): Cursor | null {
  if (!cursor) return null
  try {
    const [value, id] = Buffer.from(cursor, "base64url").toString("utf8").split("\0")
    if (!value || !id) return null
    return { value, id }
  } catch {
    /*
     * A malformed cursor reads as "start from the beginning".
     *
     * The alternative is a 400 on a link somebody pasted or a cursor that
     * outlived a deploy — an error for a request whose intent is perfectly
     * clear. Nothing is skipped by starting over; a page is repeated at worst.
     */
    return null
  }
}

/**
 * One page out of `limit + 1` rows.
 *
 * Fetching one extra row is how "is there more" is answered without a second
 * COUNT query over the same predicate — and a COUNT that disagrees with the
 * page it describes is worse than no count at all.
 */
export function pageOf<T>(
  rows: T[],
  limit: number,
  toCursor: (row: T) => string
): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  return {
    items,
    nextCursor: hasMore && last !== undefined ? toCursor(last) : null,
  }
}
