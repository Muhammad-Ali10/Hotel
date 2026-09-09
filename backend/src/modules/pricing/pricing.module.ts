import { Module } from "@nestjs/common"

import { InventoryModule } from "../inventory/inventory.module"
import { PricingController } from "./pricing.controller"
import { PricingRepository } from "./pricing.repository"
import { PricingService } from "./pricing.service"
import { JobLockService } from "../../common/scheduling/job-lock.service"
import {
  AdminPromotionsController,
  PartnerPromotionsController,
} from "./promotions.controller"
import { PromotionsJobs } from "./promotions.jobs"
import { PromotionsRepository } from "./promotions.repository"
import { PromotionsService } from "./promotions.service"
import { QuoteTokenService } from "./quote-token.service"

@Module({
  // Availability resolution is the Inventory module's job; pricing consumes it
  // through the exported repository rather than re-implementing the calendar.
  imports: [InventoryModule],
  controllers: [PricingController, PartnerPromotionsController, AdminPromotionsController],
  providers: [
    PricingService,
    PricingRepository,
    QuoteTokenService,
    PromotionsService,
    PromotionsRepository,
    PromotionsJobs,
    JobLockService,
  ],
  exports: [PricingService, QuoteTokenService, PromotionsService],
})
export class PricingModule {}
