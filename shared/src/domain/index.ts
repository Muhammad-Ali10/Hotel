/* ============================================================================
 * The domain layer — every business rule in `docs/BUSINESS-RULES.md`, as pure
 * functions.
 *
 * Nothing here imports a framework, touches I/O, or reads a clock it was not
 * handed. That is what lets the Next frontend show an optimistic price with the
 * exact code the Nest API charges by, and lets all 195 tests run without a
 * database.
 *
 * ⚠️ `availability.ts` is ADVISORY — it cannot prevent overbooking, and says so
 * in its own header. The binding guard is the booking transaction.
 * ========================================================================== */

export * from "./money"
export * from "./dates"
export * from "./pricing"
export * from "./availability"
export * from "./promotions"
export * from "./cancellation"
export * from "./booking-status"
export * from "./commission"
export * from "./loyalty"
export * from "./notifications"
export * from "./payments"
export * from "./payouts"
export * from "./reviews"
export * from "./refs"
export * from "./analytics"
export * from "./listing"
export * from "./admin-refund"
export * from "./settlement-mode"
export * from "./listing-score"
export * from "./occupancy-pricing"
export * from "./cancellation-presets"
export * from "./registration"
export * from "./ranking"
export * from "./admin-roles"
