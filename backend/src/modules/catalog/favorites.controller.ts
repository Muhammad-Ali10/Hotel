import { Body, Controller, Delete, Get, Param, Post, Put, Query } from "@nestjs/common"
import { z } from "zod"

import { CurrentUser } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { uuidSchema } from "@stayora/shared"
import type { AuthenticatedUser } from "../auth/auth.service"
import { FavoritesService } from "./favorites.service"

const listSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(24),
    /** Keyset cursor: the `savedAt` of the last card seen. */
    before: z.string().max(64).optional(),
  })
  .strict()

type ListInput = z.infer<typeof listSchema>

const savedAmongSchema = z
  .object({ propertyIds: z.array(uuidSchema).min(1).max(100) })
  .strict()

type SavedAmongInput = z.infer<typeof savedAmongSchema>

/**
 * The saved list — always the signed-in person's own.
 *
 * There is no `userId` anywhere in this controller, and that is the access
 * control (API1): a route that cannot name somebody else's list cannot be
 * asked for it.
 */
@Controller("favorites")
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(listSchema)) query: ListInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.favorites.list(user, query)
  }

  /**
   * Which of these are saved.
   *
   * POST rather than GET because a page of ids does not belong in a URL — long
   * query strings get truncated by proxies and logged in full by everything
   * else. It reads, it writes nothing.
   */
  @Post("lookup")
  lookup(
    @Body(new ZodValidationPipe(savedAmongSchema)) body: SavedAmongInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.favorites.savedAmong(user, body.propertyIds)
  }

  /**
   * PUT, not POST — saving is idempotent, and the heart is a state the client
   * is asserting rather than an event it is announcing. A retry after a
   * dropped response must land on the same list.
   */
  @Put(":propertyId")
  save(
    @Param("propertyId", new ZodValidationPipe(uuidSchema)) propertyId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.favorites.save(user, propertyId)
  }

  @Delete(":propertyId")
  remove(
    @Param("propertyId", new ZodValidationPipe(uuidSchema)) propertyId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.favorites.remove(user, propertyId)
  }
}
