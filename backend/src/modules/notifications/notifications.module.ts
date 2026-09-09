import { Global, Module } from "@nestjs/common"

import { JobLockService } from "../../common/scheduling/job-lock.service"
import { env } from "../../config/env"
import {
  AdminNotificationsController,
  NotificationsController,
} from "./notifications.controller"
import { NotificationsJobs } from "./notifications.jobs"
import { NotificationsRepository } from "./notifications.repository"
import { NotificationsService } from "./notifications.service"
import { EMAIL_PROVIDER } from "./provider/email-provider"
import { FakeEmailProvider } from "./provider/fake-email.provider"
import { SendGridProvider } from "./provider/sendgrid.provider"

/**
 * `@Global` because almost every module has something to tell somebody, and
 * importing this into all of them adds noise without adding information — the
 * same reasoning as `AuthModule`.
 *
 * The adapter is chosen by `MAIL_DRIVER`, defaulting to the fake (rule #55).
 * Development and the test suite must never be one misconfiguration away from
 * emailing a real address that happens to be in the seed data.
 */
@Global()
@Module({
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationsJobs,
    JobLockService,
    FakeEmailProvider,
    SendGridProvider,
    {
      provide: EMAIL_PROVIDER,
      inject: [FakeEmailProvider, SendGridProvider],
      useFactory: (fake: FakeEmailProvider, sendgrid: SendGridProvider) =>
        env.MAIL_DRIVER === "sendgrid" ? sendgrid : fake,
    },
  ],
  exports: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
