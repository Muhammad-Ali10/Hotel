import { Body, Controller, Get, Ip, Param, Post, Query } from "@nestjs/common"
import { settlementModeSchema, type SettlementModeInput } from "@stayora/shared"
import { z } from "zod"

import { AdminResource, CurrentUser, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { InvoicesService } from "./invoices.service"

const listSchema = z
  .object({
    orgId: z.uuid().optional(),
    status: z.enum(["issued", "paid", "overdue", "void"]).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict()

type ListInput = z.infer<typeof listSchema>

/**
 * Running the month by hand.
 *
 * The cron does this on the 1st. The endpoint exists because a run that can
 * only ever happen on a schedule is one nobody can re-run after fixing the
 * reason it failed — and it is safe to call twice, at two levels: already-billed
 * bookings are excluded, and a unique index refuses a second invoice for the
 * same month outright.
 */
const runSchema = z
  .object({
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
  })
  .strict()
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: "`periodEnd` cannot be before `periodStart`",
    path: ["periodEnd"],
  })

type RunInput = z.infer<typeof runSchema>

const markPaidSchema = z
  .object({
    /** How it arrived — the operator reconciling this later needs it. */
    note: z.string().trim().min(3).max(500),
  })
  .strict()

type MarkPaidInput = z.infer<typeof markPaidSchema>

@Controller("admin/invoices")
@AdminResource("billing")
@Roles("admin")
export class AdminInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(listSchema)) query: ListInput) {
    return this.invoices.listAll(query)
  }

  @Get(":invoiceId")
  detail(@Param("invoiceId") invoiceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.detail({ invoiceId, user })
  }

  @Post("run")
  run(@Body(new ZodValidationPipe(runSchema)) body: RunInput) {
    return this.invoices.runForMonth(body)
  }

  /**
   * Marking one paid.
   *
   * The PLATFORM's word, not the partner's: money arrives by bank transfer and
   * somebody reconciles it. Payouts resume only when nothing is outstanding —
   * clearing one of three unpaid invoices must not release the money.
   */
  /**
   * Granting or revoking invoice terms (rules #91, #92).
   *
   * On `admin/invoices` rather than on the org update, because it is not a
   * detail of the partner's profile — it decides where the platform's money
   * sits, and it needs a stated reason that lands in the audit log.
   */
  @Post("orgs/:orgId/mode")
  setMode(
    @Param("orgId") orgId: string,
    @Body(new ZodValidationPipe(settlementModeSchema)) body: SettlementModeInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    return this.invoices.setMode({ orgId, mode: body.mode, reason: body.reason, user, ip })
  }

  @Post(":invoiceId/paid")
  markPaid(
    @Param("invoiceId") invoiceId: string,
    @Body(new ZodValidationPipe(markPaidSchema)) body: MarkPaidInput
  ) {
    return this.invoices.markPaid({ invoiceId, note: body.note })
  }
}

/**
 * The partner's own bills.
 *
 * Read-only. A partner cannot mark their own invoice paid, for the same reason
 * they cannot set their own commission — it is the platform's side of the
 * agreement (rule #59).
 */
@Controller("partner/invoices")
@Roles("partner")
export class PartnerInvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.invoices.listForOrg(user)
  }

  /** With every line, so the bill can be checked rather than taken on trust. */
  @Get(":invoiceId")
  detail(@Param("invoiceId") invoiceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.invoices.detail({ invoiceId, user })
  }
}
