import { z } from "zod"

import { isoDateSchema, uuidSchema } from "./common"

/* ============================================================================
 * Promotion contracts (Module 4, the write side).
 *
 * The pricing engine could already read promotions, apply channels, pick the
 * best of several and honour one inside a signed quote — and none of it could
 * ever run, because nothing could create a promotion. Rules #3, #4 and #36 were
 * all implemented and all unreachable.
 * ========================================================================== */

export const PROMOTION_KINDS = [
  "seasonal_deal",
  "limited_time",
  "member_exclusive",
  "group_booking",
  "early_bird",
  "last_minute",
  "flash",
  /*
   * The two `boost` screens, as labels (rule #16).
   *
   * `long_stay` is a promotion with a `minStay`; `genius` is one on the
   * `genius` channel. Both already work — the label only says which screen
   * groups it, and pricing never reads it.
   */
  "long_stay",
  "genius",
] as const

export const PROMOTION_STATUSES = ["draft", "scheduled", "active", "paused", "ended"] as const

const promotionFields = {
  name: z.string().trim().min(1).max(160),
  /** Marketing categorisation only (rule #16). Pricing never reads it. */
  kind: z.enum(PROMOTION_KINDS),
  discountType: z.enum(["percent", "amount", "free_night"]),
  /**
   * A percentage, a number of cents, or a count of free nights.
   *
   * The upper bound on a percentage is enforced here AND by the table: above
   * 100 the room is not merely free, it pays the guest.
   */
  discountValue: z.int().positive(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
  /** `null` = any length of stay. */
  minStay: z.int().min(1).max(365).nullable(),
  /** Rule #3. `genius` reaches only guests whose account carries that tier. */
  channel: z.enum(["all", "mobile", "genius"]),
  status: z.enum(PROMOTION_STATUSES),
  /**
   * The properties this promotion covers. At least one.
   *
   * A partner may only name properties their own org owns — checked against
   * the database, never taken on trust (API1).
   */
  propertyIds: z.array(uuidSchema).min(1).max(200),
  /** Empty = every room of every listed property (rule #21). */
  roomIds: z.array(uuidSchema).max(500),
}

/** A percentage above 100, and a window that ends before it starts. */
const promotionRulesHold = (
  data: {
    discountType?: string
    discountValue?: number
    startDate?: string
    endDate?: string
  },
  ctx: z.RefinementCtx
) => {
  if (data.discountType === "percent" && data.discountValue !== undefined && data.discountValue > 100) {
    ctx.addIssue({
      code: "custom",
      path: ["discountValue"],
      message: "A percentage discount cannot exceed 100",
    })
  }
  if (data.startDate !== undefined && data.endDate !== undefined && data.endDate < data.startDate) {
    ctx.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "The promotion cannot end before it starts",
    })
  }
}

const promotionShape = z.object(promotionFields)

export const promotionCreateSchema = promotionShape
  .extend({
    minStay: promotionFields.minStay.default(null),
    channel: promotionFields.channel.default("all"),
    kind: promotionFields.kind.default("seasonal_deal"),
    /** New promotions start as drafts — nothing goes live by accident. */
    status: promotionFields.status.default("draft"),
    roomIds: promotionFields.roomIds.default([]),
  })
  .strict()
  .superRefine(promotionRulesHold)

export type PromotionCreateInput = z.infer<typeof promotionCreateSchema>

/**
 * A partial update, checked by the same rules.
 *
 * No `.default()` anywhere on the shared shape: a default survives
 * `.partial()`, so a PATCH of the name alone would arrive carrying
 * `status: "draft"` and `propertyIds` — silently un-publishing a live
 * promotion and dropping every property it covered.
 */
export const promotionUpdateSchema = promotionShape
  .partial()
  .strict()
  .superRefine(promotionRulesHold)

export type PromotionUpdateInput = z.infer<typeof promotionUpdateSchema>

export const promotionListSchema = z
  .object({
    status: z.enum(PROMOTION_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()

export type PromotionListInput = z.infer<typeof promotionListSchema>
