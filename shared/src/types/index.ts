/* ============================================================================
 * Stayora — canonical domain model.
 *
 * ONE shape per concept, shared by the Next frontend and the Nest API.
 *
 * The prototype carried three parallel type systems for the same entities:
 * `src/types` (Hotel · Booking · UserProfile), `src/lib/admin/types`
 * (Property · Reservation · Guest) and `src/lib/extranet/types` (a third
 * Property). A field-by-field diff showed they were never three competing
 * models — `src/types` held the entities, and the other two were list-screen
 * projections with computed metrics bolted on. This package is the entity
 * layer; those projections become DTOs derived from it.
 *
 * See docs/TYPE-MAP.md for the full mapping, and docs/BUSINESS-RULES.md for
 * the 16 decisions baked in here.
 * ========================================================================== */

export * from "./common"
export * from "./user"
export * from "./property"
export * from "./promotion"
export * from "./booking"
export * from "./payment"
export * from "./review"
export * from "./support"
export * from "./registration"
