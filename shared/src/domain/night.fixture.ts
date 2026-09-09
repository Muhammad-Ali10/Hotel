import type { ISODate } from "../types/common"
import type { RatePlanRate, ResolvedNight, RoomInventoryEntry } from "../types/property"

/**
 * One place that knows the shape of a resolved night.
 *
 * Every domain test used to build this literal itself, so adding a field to
 * `ResolvedNight` left several fixtures quietly incomplete — and because test
 * files were excluded from `tsconfig.json`, nothing said so. Both are fixed:
 * tests are typechecked now, and there is one factory to update.
 *
 * Not shipped — `tsconfig.build.json` keeps `*.fixture.ts` out of `dist`.
 */
export function makeNight(over: Partial<ResolvedNight> = {}): ResolvedNight {
  return {
    date: "2026-08-12",
    rate: 72_500,
    minStay: 1,
    minStayThrough: null,
    maxStay: null,
    closedToArrival: false,
    closedToDeparture: false,
    minAdvanceHours: null,
    isClosed: false,
    totalUnits: 28,
    sellableUnits: 28,
    bookedUnits: 0,
    ...over,
  }
}

/** A flat stay of `count` nights, all at `rate`. */
export function makeNights(count: number, rate = 72_500): ResolvedNight[] {
  return Array.from({ length: count }, (_, i) =>
    makeNight({ date: `2026-08-${String(12 + i).padStart(2, "0")}`, rate })
  )
}

/** A sparse rate-plan calendar row. Everything not overridden is `null`. */
export function makeRate(over: Partial<RatePlanRate> = {}): RatePlanRate {
  return {
    ratePlanId: "rp-flex",
    date: "2026-08-12" as ISODate,
    rate: null,
    minStay: null,
    minStayThrough: null,
    maxStay: null,
    closedToArrival: null,
    closedToDeparture: null,
    minAdvanceHours: null,
    ...over,
  }
}

/** A sparse room-inventory row. */
export function makeInventory(over: Partial<RoomInventoryEntry> = {}): RoomInventoryEntry {
  return {
    roomId: "r-deluxe",
    date: "2026-08-12" as ISODate,
    isClosed: null,
    totalUnits: 28,
    sellableUnits: 28,
    bookedUnits: 0,
    ...over,
  }
}
