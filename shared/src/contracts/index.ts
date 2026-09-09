/* ============================================================================
 * API contracts — zod schemas shared by the Next forms and the Nest routes.
 *
 * One schema per boundary, imported by both sides, so a validation rule cannot
 * exist in two slightly different versions.
 *
 * Every input object is `.strict()`: unknown keys are rejected rather than
 * ignored, which is the mass-assignment guard (docs/ARCHITECTURE.md §5, API3).
 * ========================================================================== */

export * from "./common"
export * from "./auth"
export * from "./catalog"
export * from "./inventory"
export * from "./pricing"
export * from "./promotions"
export * from "./bookings"
export * from "./payments"
export * from "./partner"
export * from "./reviews"
export * from "./analytics"
export * from "./admin"
export * from "./support"
export * from "./finance-reports"
export * from "./registration"
