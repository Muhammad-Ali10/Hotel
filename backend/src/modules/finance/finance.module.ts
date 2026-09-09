import { Module } from "@nestjs/common"

import { JobLockService } from "../../common/scheduling/job-lock.service"
import { AdminPayoutsController, PartnerPayoutsController } from "./finance.controller"
import {
  AdminFinanceReportsController,
  PartnerFinanceReportsController,
} from "./finance-reports.controller"
import { FinanceReportsRepository } from "./finance-reports.repository"
import { FinanceReportsService } from "./finance-reports.service"
import { AnalyticsModule } from "../analytics/analytics.module"
import { FinanceJobs } from "./finance.jobs"
import { FinanceRepository } from "./finance.repository"
import { AdminModule } from "../admin/admin.module"
import { FinanceService } from "./finance.service"
import { InvoicesService } from "./invoices.service"
import { AdminInvoicesController, PartnerInvoicesController } from "./invoices.controller"
import { FakePayoutProvider } from "./provider/fake-payout.provider"
import { PAYOUT_PROVIDER } from "./provider/payout-provider"

/**
 * The payout provider is chosen here, and nowhere else (rule #43).
 *
 * Separate from the payment provider on purpose: collecting from cards and
 * transferring to bank accounts are different products, and a platform can
 * perfectly well use one company for each.
 */
@Module({
  // For the audit log: granting invoice terms is a decision about where the
  // platform's money sits, and it has to be answerable later (rule #77).
  // Analytics owns `scopedPropertyIds` — which properties a member may ask
  // about. Finance reuses it rather than re-deriving the same scope, so the
  // two surfaces can never disagree on what a partner is allowed to see.
  imports: [AdminModule, AnalyticsModule],
  controllers: [
    PartnerPayoutsController,
    AdminPayoutsController,
    AdminInvoicesController,
    PartnerInvoicesController,
    PartnerFinanceReportsController,
    AdminFinanceReportsController,
  ],
  providers: [
    FinanceService,
    FinanceRepository,
    FinanceJobs,
    JobLockService,
    FakePayoutProvider,
    { provide: PAYOUT_PROVIDER, useExisting: FakePayoutProvider },
    InvoicesService,
    FinanceReportsService,
    FinanceReportsRepository,
  ],
  exports: [FinanceService, FinanceRepository],
})
export class FinanceModule {}
