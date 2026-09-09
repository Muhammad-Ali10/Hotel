import { Module } from "@nestjs/common"

import { AdminModule } from "../admin/admin.module"
import { CatalogModule } from "../catalog/catalog.module"
import { NotificationsModule } from "../notifications/notifications.module"
import { StorageModule } from "../storage/storage.module"
import {
  AdminRegistrationController,
  RegistrationController,
} from "./registration.controller"
import { RegistrationRepository } from "./registration.repository"
import { RegistrationSubmitRepository } from "./registration-submit.repository"
import { RegistrationService } from "./registration.service"

/**
 * Module 12 — the registration wizard (rule #103).
 *
 * `StorageModule` for the verification documents, which go straight to storage
 * on a presigned URL like every other file (rule #73). `AdminModule` for the
 * audit log: approving a registration creates a business, and that has to be
 * answerable later (rule #77).
 */
@Module({
  /*
   * `CatalogModule` for `recomputeBasePrice`. Approval creates the rate plans,
   * so approval is what has to settle the property's "from" price — see the
   * note in `decide`.
   */
  imports: [AdminModule, CatalogModule, NotificationsModule, StorageModule],
  controllers: [RegistrationController, AdminRegistrationController],
  providers: [RegistrationService, RegistrationRepository, RegistrationSubmitRepository],
  exports: [RegistrationService],
})
export class RegistrationModule {}
