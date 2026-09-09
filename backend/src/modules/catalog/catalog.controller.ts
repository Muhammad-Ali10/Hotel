import { Body, Controller, Get, Headers, Param, Patch, Query } from "@nestjs/common"
import {
  propertySearchSchema,
  propertyUpdateSchema,
  type PropertySearchInput,
  type PropertyUpdateInput,
} from "@stayora/shared"

import { z } from "zod"

import { CurrentUser, Public, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { CatalogService } from "./catalog.service"

/**
 * The public catalogue.
 *
 * `@Public()` — but the guard still resolves a session when one is present,
 * because a signed-in guest's tier changes the price they are shown (rule #3).
 */
@Controller("properties")
@Public()
export class PropertiesController {
  constructor(private readonly catalog: CatalogService) {}

  /**
   * The public search.
   *
   * The two headers are optional and untrusted — an opaque session id the
   * client generates and rotates, and which surface it came from. Both are
   * hashed or whitelisted before they reach a column (rule #68), and a request
   * that sends neither is recorded just the same, only less usefully.
   */
  @Get()
  search(
    @Query(new ZodValidationPipe(propertySearchSchema)) query: PropertySearchInput,
    @CurrentUser() user: AuthenticatedUser | null,
    @Headers("x-stayora-session") sessionId?: string,
    @Headers("x-stayora-surface") surface?: string
  ) {
    return this.catalog.search(query, {
      // Capped before it is hashed: an unbounded header is an unbounded write.
      sessionId: sessionId?.slice(0, 200) ?? null,
      surface: surface ?? null,
      userId: user?.id ?? null,
    })
  }

  /**
   * By SLUG, not id.
   *
   * The slug is the guest-facing handle; exposing the UUID in a URL invites
   * treating it as a permission boundary, which it is not.
   */
  @Get(":slug")
  detail(@Param("slug") slug: string) {
    return this.catalog.detailBySlug(slug)
  }
}

const destinationsQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(24).default(8) })
  .strict()

type DestinationsQuery = z.infer<typeof destinationsQuerySchema>

/**
 * The platform's own figures, for the pages that describe it.
 *
 * Public and unauthenticated, because `/about` and `/press` are. Nothing here
 * is not already derivable by paging the search results — it is the same
 * catalogue, counted once instead of by hand.
 */
@Controller("platform/stats")
@Public()
export class PlatformStatsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  stats() {
    return this.catalog.platformStats()
  }
}

/**
 * Where the marketplace sells, for the home page.
 *
 * Public and countable: every figure is over live properties, so a card saying
 * "6 hotels" is six hotels somebody can click through to.
 */
@Controller("destinations")
@Public()
export class DestinationsController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query(new ZodValidationPipe(destinationsQuerySchema)) query: DestinationsQuery) {
    return this.catalog.destinations(query.limit)
  }
}

/**
 * The partner's own properties.
 *
 * Every route is scoped to the caller's org inside the repository query, so a
 * missing check cannot leak another partner's data (API1).
 */
@Controller("partner/properties")
@Roles("partner")
export class PartnerPropertiesController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.catalog.listForPartner(user)
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(propertyUpdateSchema)) body: PropertyUpdateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.catalog.updateForPartner(id, body, user)
  }
}
