import { z } from "zod"

/* ============================================================================
 * Contract primitives — the building blocks every endpoint schema reuses.
 *
 * These live in `shared` so the Next forms and the Nest routes validate against
 * the SAME object. A rule that exists in two places is a rule that will
 * eventually be two different rules.
 * ========================================================================== */

/** Trimmed and lower-cased, so `John@X.com ` and `john@x.com` are one account. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"))
  .refine((v) => v.length <= 254, "That email address is too long")

export const uuidSchema = z.uuid()

/** `yyyy-mm-dd`. Rejects 2026-02-30, which `new Date` would silently roll. */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the yyyy-mm-dd format")
  .refine((v) => {
    const parsed = new Date(`${v}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v
  }, "That date does not exist")

/** Money crossing the wire is cents, and always a whole number. */
export const centsSchema = z.int().nonnegative()

export const paginationSchema = z.object({
  /** Opaque — from a previous response's `nextCursor`. */
  cursor: z.string().max(256).optional(),
  /**
   * Hard cap at 100 (docs/ARCHITECTURE.md §5, API4): an unbounded page size is
   * a free way to make the database do arbitrary work.
   */
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type Pagination = z.infer<typeof paginationSchema>

/** The single error shape the API returns. Mirrors AllExceptionsFilter. */
export const apiErrorSchema = z.object({
  statusCode: z.int(),
  code: z.string(),
  message: z.union([z.string(), z.array(z.string())]),
  path: z.string(),
})

export type ApiError = z.infer<typeof apiErrorSchema>
