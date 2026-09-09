import { Module } from "@nestjs/common"

import {
  AdminReviewsController,
  PartnerReviewsController,
  PropertyReviewsController,
  ReviewsController,
} from "./reviews.controller"
import { ReviewsRepository } from "./reviews.repository"
import { ReviewsService } from "./reviews.service"

@Module({
  controllers: [
    PropertyReviewsController,
    ReviewsController,
    PartnerReviewsController,
    AdminReviewsController,
  ],
  providers: [ReviewsService, ReviewsRepository],
  // Exported so the catalog can show a property's rating without a second
  // source of truth for how one is calculated.
  exports: [ReviewsService],
})
export class ReviewsModule {}
