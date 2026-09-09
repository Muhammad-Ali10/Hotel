/* ============================================================================
 * Human-facing reference codes.
 *
 * These are NOT primary keys. A booking's `id` is a UUID and its `ref` is this
 * — in the prototype the ref WAS the id, so changing the format would have
 * meant rewriting every foreign key.
 * ========================================================================== */

/**
 * 32 characters. `I`, `O`, `0` and `1` are omitted so a reference read down a
 * phone line cannot be misheard — `STY-1O0I` has no unambiguous reading.
 */
export const BOOKING_REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

const BOOKING_REF_LENGTH = 6
const BOOKING_REF_RE = new RegExp(`^STY-[${BOOKING_REF_ALPHABET}]{${BOOKING_REF_LENGTH}}$`)

/**
 * `STY-XXXXXX` — about 1.07 billion combinations.
 *
 * `random` is injectable so a test can pin the output; production passes
 * nothing and gets `Math.random`. Uniqueness is NOT this function's job — the
 * database's unique index is, and the caller retries on conflict.
 */
export function makeBookingRef(random: () => number = Math.random): string {
  let out = ""
  for (let i = 0; i < BOOKING_REF_LENGTH; i++) {
    const index = Math.floor(random() * BOOKING_REF_ALPHABET.length)
    out += BOOKING_REF_ALPHABET[Math.min(index, BOOKING_REF_ALPHABET.length - 1)]
  }
  return `STY-${out}`
}

export function isValidBookingRef(value: string): boolean {
  return BOOKING_REF_RE.test(value)
}

/**
 * `TKT-000123`, formatted from a database sequence (rule #8).
 *
 * The prototype generated `TKT-1000`…`TKT-9999` at random with no uniqueness
 * check at all: 9,000 possible values, and past roughly a hundred tickets a
 * collision is more likely than not. A sequence cannot collide, so this is
 * formatting only — there is deliberately no random variant.
 */
export function formatTicketRef(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(`Ticket sequence must be a positive integer, received: ${sequence}`)
  }
  return `TKT-${String(sequence).padStart(6, "0")}`
}

const TICKET_REF_RE = /^TKT-\d{6,}$/

export function isValidTicketRef(value: string): boolean {
  return TICKET_REF_RE.test(value)
}
