import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common"
import { z } from "zod"

import { AdminResource, CurrentUser, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { FinanceService } from "./finance.service"

const payoutListSchema = z
  .object({
    status: z.enum(["pending", "processing", "paid", "failed"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(24),
  })
  .strict()

/**
 * The platform's version takes one more filter.
 *
 * A partner's list is already scoped to their own org by the session; the
 * platform's sees every org, and "show me this client's settlements" is the
 * first thing anybody asks of it.
 */
const adminPayoutListSchema = payoutListSchema.extend({
  orgId: z.uuid().optional(),
})

type AdminPayoutListInput = z.infer<typeof adminPayoutListSchema>

type PayoutListInput = z.infer<typeof payoutListSchema>

/**
 * Where a property's money is sent.
 *
 * There is no account number and no sort code, deliberately. The provider
 * holds those — it is already the thing that moves the money — and a reference
 * is all this system needs. Accepting the real digits would make this database
 * worth attacking, and this product's problem to secure, for no capability it
 * does not already have.
 */
const payoutAccountSchema = z
  .object({
    providerAccountRef: z.string().trim().min(1).max(128),
    holderName: z.string().trim().min(2).max(160),
    /** For recognising the account on a screen. Four digits, and no more. */
    last4: z.string().trim().regex(/^\d{4}$/, "Enter the last four digits"),
    bankName: z.string().trim().max(120).default(""),
    currency: z.literal("USD").default("USD"),
  })
  .strict()

type PayoutAccountInput = z.infer<typeof payoutAccountSchema>

const verifyAccountSchema = z.object({ verified: z.boolean() }).strict()
type VerifyAccountInput = z.infer<typeof verifyAccountSchema>

/**
 * A property's own settlements.
 *
 * The org is taken from the session, never from a parameter — an `orgId` in the
 * query string would be a way to read a competitor's revenue (API1).
 */
@Controller("partner/payouts")
@Roles("partner")
export class PartnerPayoutsController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(payoutListSchema)) query: PayoutListInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.finance.listForPartner(user, query.limit)
  }

  /**
   * The payout account, as a settings screen needs it.
   *
   * Declared BEFORE `:id`, or Nest matches "account" as a payout id and every
   * request 404s with a message about a payout nobody asked for.
   */
  @Get("account")
  account(@CurrentUser() user: AuthenticatedUser) {
    return this.finance.accountFor(user)
  }

  /**
   * Points the money somewhere.
   *
   * Always lands `unverified`, and an org admin is the only role that may do
   * it: re-pointing a payout account is how a compromised partner login turns
   * into a bank transfer.
   */
  @Post("account")
  saveAccount(
    @Body(new ZodValidationPipe(payoutAccountSchema)) body: PayoutAccountInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.finance.saveAccount({ ...body, user })
  }

  /** One settlement, broken down to the stays behind it. */
  @Get(":id")
  statement(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.finance.statementFor(id, user)
  }
}

@Controller("admin/payouts")
@AdminResource("finance")
@Roles("admin")
export class AdminPayoutsController {
  constructor(private readonly finance: FinanceService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(adminPayoutListSchema)) query: AdminPayoutListInput
  ) {
    return this.finance.listAll(query)
  }

  @Get(":id")
  statement(@Param("id") id: string) {
    return this.finance.adminStatementFor(id)
  }

  /**
   * Retries a transfer that the bank rejected.
   *
   * Only the TRANSFER is retried — the settlement and its lines already exist,
   * so no stay is recounted and no figure moves. That separation is what makes
   * a failed payout safe to touch.
   */
  @Post(":id/retry")
  retry(@Param("id") id: string) {
    return this.finance.retry(id)
  }

  /**
   * Approving a payout account.
   *
   * The only thing that makes one payable. Everything else about a property
   * can be self-service; this cannot, because the failure mode is a transfer
   * to a stranger's bank that nobody can recall.
   */
  @Post("accounts/:orgId/verify")
  verifyAccount(
    @Param("orgId") orgId: string,
    @Body(new ZodValidationPipe(verifyAccountSchema)) body: VerifyAccountInput
  ) {
    return this.finance.verifyAccount(orgId, body.verified)
  }

  /**
   * Runs the settlement now.
   *
   * For a run the scheduler missed. Safe to press twice: `payouts_org_period_
   * unique` allows one settlement per property per period, and
   * `payout_items_booking_unique` allows one settlement per stay, ever.
   */
  @Post("run")
  run() {
    return this.finance.runAll()
  }
}
