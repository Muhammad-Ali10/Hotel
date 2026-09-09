import { Body, Controller, Get, Param, Post, Query, HttpCode } from "@nestjs/common"
import {
  analyticsRangeSchema,
  analyticsTrendSchema,
  platformRangeSchema,
  searchClickSchema,
  type AnalyticsRangeInput,
  type AnalyticsTrendInput,
  type PlatformRangeInput,
  type SearchClickInput,
  isoDateSchema,
  uuidSchema,
  MAX_RANGE_DAYS,
} from "@stayora/shared"

import { z } from "zod"

import { AdminResource, CurrentUser, Public, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { AnalyticsEventsService } from "./analytics-events.service"
import { AnalyticsService } from "./analytics.service"
import { RankingService } from "./ranking.service"

/**
 * The partner's analytics.
 *
 * Every route resolves its own scope from the session (API1) and decides
 * whether money appears from the caller's role (rule #66) — there is no
 * `orgId` parameter anywhere, and no route trusts a `propertyId` it was handed
 * without intersecting it against what the caller already had.
 */
@Controller("partner/analytics")
@Roles("partner")
export class PartnerAnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly rankingService: RankingService
  ) {}

  /** Revenue and bookings over time, by BOOKING date (rule #62). */
  @Get("sales")
  sales(
    @Query(new ZodValidationPipe(analyticsTrendSchema)) query: AnalyticsTrendInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.analytics.sales(user, query)
  }

  /** ADR, occupancy and RevPAR per property, by STAY date (rule #62). */
  @Get("performance")
  performance(
    @Query(new ZodValidationPipe(analyticsRangeSchema)) query: AnalyticsRangeInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.analytics.performance(user, query)
  }

  /** Nights already stayed, and what is on the books ahead. */
  @Get("pace")
  pace(
    @Query(new ZodValidationPipe(analyticsTrendSchema)) query: AnalyticsTrendInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.analytics.pace(user, query)
  }

  @Get("cancellations")
  cancellations(
    @Query(new ZodValidationPipe(analyticsRangeSchema)) query: AnalyticsRangeInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.analytics.cancellations(user, query)
  }

  @Get("book-window")
  bookWindow(
    @Query(new ZodValidationPipe(analyticsRangeSchema)) query: AnalyticsRangeInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.analytics.bookWindow(user, query)
  }

  @Get("bookers")
  bookers(
    @Query(new ZodValidationPipe(analyticsRangeSchema)) query: AnalyticsRangeInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.analytics.bookers(user, query)
  }

  @Get("genius")
  genius(
    @Query(new ZodValidationPipe(analyticsRangeSchema)) query: AnalyticsRangeInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.analytics.genius(user, query)
  }

  /** How one property sits against its city, anonymously (rule #65). */
  /**
   * Where this listing sits in search, and why (rule #104).
   *
   * Every factor with its weight and its contribution — because a ranking a
   * partner cannot check is one they argue with, and "improve your
   * visibility" with no numbers behind it is the least actionable sentence a
   * marketplace can print.
   */
  @Get("ranking/:propertyId")
  ranking(
    @Param("propertyId") propertyId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.rankingService.forProperty({ user, propertyId })
  }

  /** What travellers searched for in THIS partner's cities (rule #67). */
  @Get("demand")
  demand(
    @Query(new ZodValidationPipe(analyticsRangeSchema)) query: AnalyticsRangeInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.rankingService.demandForPartner({ user, from: query.from, to: query.to })
  }

  @Get("comparables")
  comparables(
    @Query(new ZodValidationPipe(analyticsRangeSchema)) query: AnalyticsRangeInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.analytics.comparables(user, query)
  }
}

/**
 * The one analytics write a browser can reach (rule #67).
 *
 * `@Public()` because a search result is clicked long before anybody signs in,
 * and requiring a session would record only the fraction of behaviour that
 * comes from returning guests — which is the population least like the one the
 * Ranking screen is trying to describe.
 */
@Controller("search-events")
@Public()
export class SearchEventsController {
  constructor(private readonly events: AnalyticsEventsService) {}

  /**
   * Records that a search result was opened.
   *
   * Always 204, even for a search id that does not exist. Answering "no such
   * search" would turn this into an oracle over event ids for anybody who
   * wanted one, and there is nothing a caller could do with the truth.
   *
   * A property can only inflate its own conversion this way, and only its own
   * screens read that number — nothing about search ordering depends on it.
   * One click per search per property is all the primary key permits.
   */
  @Post(":id/click")
  @HttpCode(204)
  async click(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(searchClickSchema)) body: SearchClickInput
  ) {
    await this.events.recordClick({ searchEventId: id, propertyId: body.propertyId })
  }
}

/**
 * The client ranking's own query: the range, plus how many rows.
 *
 * Built by hand rather than by extending `platformRangeSchema` — that schema
 * carries a `.superRefine`, and zod 4 has no `.extend()` on a refined type. A
 * wrapper would silently drop the range ceiling, which is the one thing on it
 * that matters (API4).
 */
const platformClientsSchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
    orgId: uuidSchema.optional(),
    granularity: z.enum(["day", "week", "month"]).default("month"),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.to < value.from) {
      ctx.addIssue({ code: "custom", path: ["to"], message: "`to` cannot be before `from`" })
      return
    }
    const days =
      (Date.parse(`${value.to}T00:00:00Z`) - Date.parse(`${value.from}T00:00:00Z`)) / 86_400_000
    if (days > MAX_RANGE_DAYS) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `Range cannot exceed ${MAX_RANGE_DAYS} days`,
      })
    }
  })

type PlatformClientsInput = z.infer<typeof platformClientsSchema>

/**
 * The platform's own analytics (rules #82–#84).
 *
 * The same engine, unscoped. `revenue` here means COMMISSION and `gmv` means
 * the guests' money — two fields with two names, so no screen can present one
 * as the other and make every derived figure wrong at once.
 */
@Controller("admin/analytics")
@AdminResource("analytics")
@Roles("admin")
export class AdminAnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly rankingService: RankingService
  ) {}

  @Get("overview")
  overview(@Query(new ZodValidationPipe(platformRangeSchema)) query: PlatformRangeInput) {
    return this.analytics.platformOverview(query)
  }

  @Get("sales")
  sales(@Query(new ZodValidationPipe(platformRangeSchema)) query: PlatformRangeInput) {
    return this.analytics.platformSales(query)
  }

  /** Every client, ranked by what they brought the platform — not by GMV. */
  /** The whole map: what travellers searched for, and what came back empty. */
  @Get("demand")
  demand(@Query(new ZodValidationPipe(platformClientsSchema)) query: PlatformClientsInput) {
    return this.rankingService.demandForPlatform({
      from: query.from,
      to: query.to,
      limit: query.limit,
    })
  }

  @Get("clients")
  clients(@Query(new ZodValidationPipe(platformClientsSchema)) query: PlatformClientsInput) {
    return this.analytics.platformClients(query)
  }
}
