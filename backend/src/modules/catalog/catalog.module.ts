import { Module } from "@nestjs/common"

import { AdminModule } from "../admin/admin.module"
import { AnalyticsModule } from "../analytics/analytics.module"
import { ReviewsModule } from "../reviews/reviews.module"

import {
  DestinationsController,
  PartnerPropertiesController,
  PlatformStatsController,
  PropertiesController,
} from "./catalog.controller"
import { CatalogRepository } from "./catalog.repository"
import { CatalogService } from "./catalog.service"
import { FavoritesController } from "./favorites.controller"
import { FavoritesRepository } from "./favorites.repository"
import { FavoritesService } from "./favorites.service"
import {
  AdminAmenitiesController,
  AdminContentController,
  AdminListingController,
  AmenitiesController,
  PartnerListingController,
} from "./listing.controller"
import { ListingRepository } from "./listing.repository"
import { ListingService } from "./listing.service"
import {
  PartnerRatePlanController,
  PartnerRoomController,
  PartnerRoomsController,
  PartnerPropertyRatePlansController,
  PartnerValueAddController,
  PartnerValueAddsController,
} from "./rooms.controller"
import { RoomsRepository } from "./rooms.repository"
import { RoomsService } from "./rooms.service"

@Module({
  // Ratings are derived from reviews, so the catalogue asks the module that
  // owns them rather than growing a second way to average the same rows.
  //
  // Analytics comes in for the search recording (rule #67): the event has to
  // be written where the search actually happens, and only this module knows
  // which properties came back and in what order.
  // Approving, rejecting and suspending a listing are platform decisions
  // somebody has to be able to answer for later (rule #77).
  imports: [ReviewsModule, AnalyticsModule, AdminModule],
  controllers: [
    PropertiesController,
    DestinationsController,
    PlatformStatsController,
    PartnerPropertiesController,
    PartnerRoomsController,
    PartnerPropertyRatePlansController,
    PartnerRoomController,
    PartnerRatePlanController,
    PartnerValueAddsController,
    PartnerValueAddController,
    PartnerListingController,
    AmenitiesController,
    AdminListingController,
    AdminAmenitiesController,
    AdminContentController,
    FavoritesController,
  ],
  providers: [
    CatalogService,
    CatalogRepository,
    RoomsService,
    RoomsRepository,
    ListingService,
    ListingRepository,
    FavoritesService,
    FavoritesRepository,
  ],
  exports: [CatalogService, CatalogRepository, RoomsService, ListingService, FavoritesService],
})
export class CatalogModule {}
