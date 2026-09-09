import { Controller, Get, Query } from "@nestjs/common"
import {
  financeRangeSchema,
  platformFinanceRangeSchema,
  transactionsQuerySchema,
  type FinanceRangeInput,
  type PlatformFinanceRangeInput,
  type TransactionsQueryInput,
} from "@stayora/shared"

import { AdminResource, CurrentUser, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { FinanceReportsService } from "./finance-reports.service"

/**
 * A partner's own money (extranet `finance/*`).
 *
 * Read-only, all four routes. Nothing here moves a cent — payouts have their
 * own controller and their own guards, and a reporting screen that could also
 * release money is a screen one wrong click away from doing it.
 *
 * Whether the caller's ROLE may see money at all is decided in the service
 * (rule #66), not here: `@Roles("partner")` is about which surface you are on,
 * and front-desk staff are legitimately on this one.
 */
@Controller("partner/finance")
@Roles("partner")
export class PartnerFinanceReportsController {
  constructor(private readonly reports: FinanceReportsService) {}

  @Get("overview")
  overview(
    @Query(new ZodValidationPipe(financeRangeSchema)) query: FinanceRangeInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.reports.overview(user, query)
  }

  @Get("revenue")
  revenue(
    @Query(new ZodValidationPipe(financeRangeSchema)) query: FinanceRangeInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.reports.revenue(user, query)
  }

  @Get("commissions")
  commissions(
    @Query(new ZodValidationPipe(financeRangeSchema)) query: FinanceRangeInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.reports.commissions(user, query)
  }

  @Get("transactions")
  transactions(
    @Query(new ZodValidationPipe(transactionsQuerySchema)) query: TransactionsQueryInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.reports.transactions(user, query)
  }
}

/**
 * The same four reports, with the scope taken off (rule #84).
 *
 * `orgId` narrows to one client. Absent means the whole marketplace — which is
 * a thing only the platform may ask, and the reason this is a separate
 * controller rather than an extra query parameter on the partner's.
 */
@Controller("admin/finance")
@AdminResource("finance")
@Roles("admin")
export class AdminFinanceReportsController {
  constructor(private readonly reports: FinanceReportsService) {}

  @Get("overview")
  overview(
    @Query(new ZodValidationPipe(platformFinanceRangeSchema)) query: PlatformFinanceRangeInput
  ) {
    return this.reports.platformOverview(query)
  }

  @Get("revenue")
  revenue(
    @Query(new ZodValidationPipe(platformFinanceRangeSchema)) query: PlatformFinanceRangeInput
  ) {
    return this.reports.platformRevenue(query)
  }

  @Get("commissions")
  commissions(
    @Query(new ZodValidationPipe(platformFinanceRangeSchema)) query: PlatformFinanceRangeInput
  ) {
    return this.reports.platformCommissions(query)
  }

  @Get("transactions")
  transactions(
    @Query(new ZodValidationPipe(transactionsQuerySchema)) query: TransactionsQueryInput
  ) {
    return this.reports.platformTransactions(query)
  }
}
