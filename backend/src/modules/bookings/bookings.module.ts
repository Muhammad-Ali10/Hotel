import { Module, forwardRef } from "@nestjs/common"

import { InventoryModule } from "../inventory/inventory.module"
import { PaymentsModule } from "../payments/payments.module"
import { PricingModule } from "../pricing/pricing.module"
import { JobLockService } from "../../common/scheduling/job-lock.service"
import { BookingsController, PartnerBookingsController } from "./bookings.controller"
import { BookingsJobs } from "./bookings.jobs"
import { BookingsRepository } from "./bookings.repository"
import { BookingsService } from "./bookings.service"
import { BookingsSupportRepository } from "./bookings-support.repository"

@Module({
  imports: [InventoryModule, PricingModule, forwardRef(() => PaymentsModule)],
  controllers: [BookingsController, PartnerBookingsController],
  providers: [BookingsService, BookingsRepository, BookingsSupportRepository, BookingsJobs, JobLockService],
  // `BookingsSupportRepository` is exported for the admin refund, which needs
  // the PROPERTY's clock to know when "free until 6pm" actually fell (rule
  // #33). Reading that deadline in UTC would move it by hours.
  exports: [BookingsService, BookingsRepository, BookingsSupportRepository],
})
export class BookingsModule {}
