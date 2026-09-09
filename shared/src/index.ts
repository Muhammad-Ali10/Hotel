/**
 * `@stayora/shared` — the single source of truth for the domain.
 *
 * Consumed by BOTH the Next frontend (optimistic previews) and the Nest API
 * (authoritative calculation). One implementation in two places means the two
 * cannot disagree about a price, a refund or an availability answer.
 *
 * Nothing here may import a framework, touch I/O, or read a clock it was not
 * handed — every domain function is pure so it can be tested without a
 * database and run on either side of the wire.
 */

export * from "./types"
export * from "./domain"
export * from "./contracts"
