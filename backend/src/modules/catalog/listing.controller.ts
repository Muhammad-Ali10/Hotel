import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query } from "@nestjs/common"
import {
  adminPropertySearchSchema,
  amenityUpsertSchema,
  listingDecisionSchema,
  photoConfirmSchema,
  photoUpdateSchema,
  photoUploadRequestSchema,
  propertyCreateSchema,
  propertySuspensionSchema,
  propertyUpdateSchema,
  type AdminPropertySearchInput,
  type AmenityUpsertInput,
  type ListingDecisionInput,
  type PhotoConfirmInput,
  type PhotoUpdateInput,
  type PhotoUploadRequestInput,
  type PropertyCreateInput,
  type PropertySuspensionInput,
  type PropertyUpdateInput,
} from "@stayora/shared"
import { z } from "zod"

import { AdminResource, CurrentUser, Public, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { ListingService } from "./listing.service"

const limitSchema = z
  .object({ limit: z.coerce.number().int().min(1).max(100).default(50) })
  .strict()

type LimitInput = z.infer<typeof limitSchema>

/**
 * Building a listing (rules #69–#73).
 *
 * Every route resolves the property from the caller's own org, so an id from
 * somebody else's portfolio is a 404 rather than a 403 (API1). `staff` is
 * refused throughout: a front-desk account is not the thing that should be
 * able to rename a hotel or replace its photography.
 */
@Controller("partner/listings")
@Roles("partner")
export class PartnerListingController {
  constructor(private readonly listings: ListingService) {}

  /** The write path that did not exist — a property could only be seeded. */
  @Post()
  create(
    @Body(new ZodValidationPipe(propertyCreateSchema)) body: PropertyCreateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.listings.create({ user, body })
  }

  /** The single-property read the extranet never had. Carries its own gaps. */
  @Get(":propertyId")
  detail(@Param("propertyId") propertyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.listings.detail({ user, propertyId })
  }

  @Patch(":propertyId")
  update(
    @Param("propertyId") propertyId: string,
    @Body(new ZodValidationPipe(propertyUpdateSchema)) body: PropertyUpdateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.listings.update({ user, propertyId, patch: body })
  }

  /** Asking the platform to look at it (rule #70). */
  @Post(":propertyId/submit")
  submit(@Param("propertyId") propertyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.listings.submit({ user, propertyId })
  }

  /**
   * How well this page is built, out of 100 (rule #99).
   *
   * The SAME computation the platform's content screen runs. A partner being
   * asked to improve a number the platform measures differently is a partner
   * being sent on an errand.
   */
  @Get(":propertyId/score")
  score(@Param("propertyId") propertyId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.listings.scoreFor({ user, propertyId })
  }

  /* -------------------------------------------------------------- photos */

  /**
   * A place to PUT one file.
   *
   * No bytes come through this API — this hands back a signed URL the browser
   * writes to directly, and no row exists until `confirm` says it landed.
   */
  @Post(":propertyId/photos/upload-url")
  uploadUrl(
    @Param("propertyId") propertyId: string,
    @Body(new ZodValidationPipe(photoUploadRequestSchema)) body: PhotoUploadRequestInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.listings.uploadUrl({ user, propertyId, body })
  }

  @Post(":propertyId/photos")
  confirmPhoto(
    @Param("propertyId") propertyId: string,
    @Body(new ZodValidationPipe(photoConfirmSchema)) body: PhotoConfirmInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.listings.confirmPhoto({ user, propertyId, body })
  }

  @Patch(":propertyId/photos/:photoId")
  updatePhoto(
    @Param("propertyId") propertyId: string,
    @Param("photoId") photoId: string,
    @Body(new ZodValidationPipe(photoUpdateSchema)) body: PhotoUpdateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.listings.updatePhoto({ user, propertyId, photoId, body })
  }

  @Delete(":propertyId/photos/:photoId")
  deletePhoto(
    @Param("propertyId") propertyId: string,
    @Param("photoId") photoId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.listings.deletePhoto({ user, propertyId, photoId })
  }
}

/**
 * The amenity vocabulary, read by anybody (rule #74).
 *
 * Public because the search filter is built from it — a guest narrowing by
 * "Free WiFi" needs the list before they have an account.
 */
@Controller("amenities")
@Public()
export class AmenitiesController {
  constructor(private readonly listings: ListingService) {}

  @Get()
  list() {
    return this.listings.amenities()
  }
}

/**
 * The platform's side: the review queue, the verdict, and the vocabulary.
 *
 * The vocabulary is admin-only on purpose (rule #74). A partner who could add
 * their own amenity would add "Wi-Fi" beside the existing "wifi", and the
 * filter that used to find every hotel with internet would start finding half.
 */
@Controller("admin/content")
@AdminResource("content")
@Roles("admin")
export class AdminContentController {
  constructor(private readonly listings: ListingService) {}

  /**
   * Every listing, scored, worst first (rule #99).
   *
   * The same filters the property list takes, because the question "which of
   * this client's pages are thin" is one screen away from "show me this
   * client's pages".
   */
  @Get()
  list(@Query(new ZodValidationPipe(adminPropertySearchSchema)) query: AdminPropertySearchInput) {
    return this.listings.contentQueue(query)
  }
}

@Controller("admin/listings")
@AdminResource("properties")
@Roles("admin")
export class AdminListingController {
  constructor(private readonly listings: ListingService) {}

  /** Waiting for a first approval, OR live with edits waiting (rule #72). */
  @Get("queue")
  queue(@Query(new ZodValidationPipe(limitSchema)) query: LimitInput) {
    return this.listings.queue(query.limit)
  }

  /**
   * Every listing on the platform, filtered.
   *
   * The queue above is this with `needsReview=true`. Kept as its own route
   * because it is a different job on a different screen, but it is the same
   * query — two implementations would be two definitions of "waiting".
   */
  @Get()
  list(@Query(new ZodValidationPipe(adminPropertySearchSchema)) query: AdminPropertySearchInput) {
    return this.listings.adminList(query)
  }

  @Get(":propertyId")
  detail(@Param("propertyId") propertyId: string) {
    return this.listings.adminDetail(propertyId)
  }

  @Post(":propertyId/decision")
  decide(
    @Param("propertyId") propertyId: string,
    @Body(new ZodValidationPipe(listingDecisionSchema)) body: ListingDecisionInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    return this.listings.decide({ propertyId, body, user, ip })
  }

  /** Off the market, or back on it. Never a delete (rules #75, #78). */
  @Post(":propertyId/suspension")
  suspension(
    @Param("propertyId") propertyId: string,
    @Body(new ZodValidationPipe(propertySuspensionSchema)) body: PropertySuspensionInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    return this.listings.setSuspension({ propertyId, body, user, ip })
  }
}

@Controller("admin/amenities")
@AdminResource("content")
@Roles("admin")
export class AdminAmenitiesController {
  constructor(private readonly listings: ListingService) {}

  @Post()
  upsert(@Body(new ZodValidationPipe(amenityUpsertSchema)) body: AmenityUpsertInput) {
    return this.listings.upsertAmenity(body)
  }
}
