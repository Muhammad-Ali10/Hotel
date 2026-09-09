import { z } from "zod"

import { paginationSchema, uuidSchema } from "./common"

/* ============================================================================
 * Review contracts (Module 6).
 * ========================================================================== */

const scoreSchema = z.int().min(1).max(5)

/**
 * The five category scores. All required — a partial set would quietly drag a
 * property's category averages towards zero, since `deriveRating` divides by
 * the number of published reviews rather than by how many scored each axis.
 */
export const reviewCategoriesSchema = z
  .object({
    cleanliness: scoreSchema,
    comfort: scoreSchema,
    location: scoreSchema,
    facilities: scoreSchema,
    staff: scoreSchema,
  })
  .strict()

/**
 * Writing a review.
 *
 * Note what is ABSENT: no property, no author, no date, no status. All of that
 * is derived server-side from the booking — a client that could name the
 * property could review one it never stayed at, and a client that could set
 * `status` could publish past a moderator.
 */
export const createReviewSchema = z
  .object({
    bookingId: uuidSchema,
    rating: scoreSchema,
    categories: reviewCategoriesSchema,
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1).max(5000),
  })
  .strict()

export type CreateReviewInput = z.infer<typeof createReviewSchema>

/** A partner replying to a review of their own property. */
export const respondToReviewSchema = z
  .object({
    text: z.string().trim().min(1).max(2000),
  })
  .strict()

export type RespondToReviewInput = z.infer<typeof respondToReviewSchema>

/**
 * A partner objecting to a review (rule #40).
 *
 * This is the safety valve that makes immediate publishing safe: the review
 * leaves the public site and the rating at once, and an admin decides
 * afterwards. A reason is required — a flag with no reason is not a report,
 * it is a delete button.
 */
export const flagReviewSchema = z
  .object({
    reason: z.string().trim().min(10).max(1000),
  })
  .strict()

export type FlagReviewInput = z.infer<typeof flagReviewSchema>

/**
 * Admin adjudication.
 *
 * Two outcomes only. `withdrawn` is absent deliberately: it is the author's
 * decision, and an admin able to set it could take a review down while it
 * reads as the guest's own doing.
 */
export const moderateReviewSchema = z
  .object({
    status: z.enum(["published", "rejected"]),
    reason: z.string().trim().max(1000).optional(),
  })
  .strict()

export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>

/**
 * The public review list.
 *
 * Page controls only. There is deliberately no `status` here: a filter on the
 * public endpoint would be a way to read the moderation queue — every review a
 * property had flagged — from the open internet.
 */
export const publicReviewListSchema = paginationSchema.strict()

export type PublicReviewListInput = z.infer<typeof publicReviewListSchema>

/** Partner and admin listings, which may filter by moderation state. */
export const reviewListSchema = paginationSchema
  .extend({
    status: z.enum(["published", "pending", "flagged", "rejected", "withdrawn"]).optional(),
  })
  .strict()

export type ReviewListInput = z.infer<typeof reviewListSchema>
