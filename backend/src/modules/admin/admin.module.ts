import { Module } from "@nestjs/common"

import { BookingsModule } from "../bookings/bookings.module"
import { NotificationsModule } from "../notifications/notifications.module"
import { PaymentsModule } from "../payments/payments.module"
import {
  AdminAuditController,
  AdminOffersController,
  AdminReservationsController,
  AdminUsersController,
} from "./admin.controller"
import { AdminRepository } from "./admin.repository"
import { AdminService } from "./admin.service"
import { AuditService } from "./audit.service"

/**
 * Module 11 — the platform's own surface (rules #76–#81).
 *
 * `AuditService` is exported because it is not this module's private business:
 * every admin action anywhere should land in the same log, and the modules that
 * already have admin routes — listings, payouts, partner orgs, reviews — need
 * to reach it. A per-module audit trail is one where the fourth module quietly
 * stops writing.
 */
@Module({
  imports: [PaymentsModule, BookingsModule, NotificationsModule],
  controllers: [
    AdminReservationsController,
    AdminUsersController,
    AdminAuditController,
    AdminOffersController,
  ],
  providers: [AdminRepository, AdminService, AuditService],
  exports: [AuditService],
})
export class AdminModule {}
