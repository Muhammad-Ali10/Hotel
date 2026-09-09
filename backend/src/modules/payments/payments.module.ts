import { Module, forwardRef } from "@nestjs/common"

import { BookingsModule } from "../bookings/bookings.module"
import { PaymentsController, PaymentsWebhookController } from "./payments.controller"
import { JobLockService } from "../../common/scheduling/job-lock.service"
import { HoldsService } from "./holds.service"
import { PaymentsJobs } from "./payments.jobs"
import { PaymentsRepository } from "./payments.repository"
import { PaymentsService } from "./payments.service"
import { FakePaymentProvider } from "./provider/fake.provider"
import { PAYMENT_PROVIDER } from "./provider/payment-provider"

/**
 * The provider is chosen HERE and nowhere else (rule #43).
 *
 * One line decides which processor the whole system talks to. The entity is
 * registered in Pakistan, where Stripe does not onboard merchants, so the
 * production adapter will be a local processor — and swapping it is this
 * binding, not a search through the booking flow.
 */
@Module({
  imports: [forwardRef(() => BookingsModule)],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [
    PaymentsService,
    PaymentsRepository,
    HoldsService,
    PaymentsJobs,
    JobLockService,
    FakePaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: FakePaymentProvider },
  ],
  exports: [PaymentsService, PaymentsRepository, HoldsService],
})
export class PaymentsModule {}
