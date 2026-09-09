import { Module } from "@nestjs/common"

import { BookingsModule } from "../bookings/bookings.module"
import {
  AdminSupportController,
  BookingMessagesController,
  PartnerMessagesController,
  PartnerSupportController,
  SupportTicketsController,
} from "./support.controller"
import { SupportRepository } from "./support.repository"
import { SupportService } from "./support.service"

/**
 * Module 13 — support (rules #85–#90).
 *
 * `SupportService` is exported for one reason: sign-in calls
 * `claimAnonymous()`, which links tickets opened without an account to the
 * person who has just proved the address is theirs (rule #86).
 */
@Module({
  imports: [BookingsModule],
  controllers: [
    SupportTicketsController,
    PartnerSupportController,
    AdminSupportController,
    BookingMessagesController,
    PartnerMessagesController,
  ],
  providers: [SupportRepository, SupportService],
  exports: [SupportService],
})
export class SupportModule {}
