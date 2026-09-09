import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from "@nestjs/common"
import {
  isReleasable,
  lineFor,
  periodToPayOn,
  summarise,
  toISODate,
  type ISODate,
  type PayoutLine,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { NotificationsService } from "../notifications/notifications.service"
import { FinanceRepository, type PayoutRow, type ReleasableBooking } from "./finance.repository"
import { PAYOUT_PROVIDER, type PayoutProvider } from "./provider/payout-provider"

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name)

  constructor(
    private readonly repo: FinanceRepository,
    @Inject(PAYOUT_PROVIDER) private readonly provider: PayoutProvider,
    private readonly notifications: NotificationsService
  ) {}

  /* -------------------------------------------------------------- the run */

  /**
   * Settles every property for the period that just closed (rule #48).
   *
   * One org failing does not stop the rest. A payout run that aborts halfway
   * leaves half the properties unpaid and no record of which half — so each is
   * settled on its own, and a failure is logged and carried to the next run.
   */
  async runAll(today = toISODate(new Date())) {
    const period = periodToPayOn(today)
    const orgIds = await this.repo.activeOrgIds()

    const results = { settled: 0, paid: 0, invoiced: 0, carried: 0, skipped: 0, failed: 0 }

    for (const orgId of orgIds) {
      try {
        const outcome = await this.runFor({ orgId, today })
        if (!outcome) {
          results.skipped++
          continue
        }
        results.settled++
        if (outcome.direction === "payout") results.paid++
        if (outcome.direction === "invoice") results.invoiced++
        if (outcome.direction === "carry") results.carried++
      } catch (error) {
        results.failed++
        this.logger.error(
          `Payout run failed for org ${orgId}`,
          error instanceof Error ? error.stack : error
        )
      }
    }

    this.logger.log(`Payout run ${period.start}–${period.end}: ${JSON.stringify(results)}`)
    return { period, ...results }
  }

  /**
   * Settles one property.
   *
   * Returns `null` when there is genuinely nothing to settle — no outstanding
   * bookings and no balance carried in. That is the common case for a property
   * with no completed stays this fortnight, and it must not leave a row behind:
   * an empty settlement would take the period number and block the real one.
   */
  async runFor(input: { orgId: string; today?: ISODate }): Promise<PayoutRow | null> {
    const today = input.today ?? toISODate(new Date())
    const period = periodToPayOn(today)

    const [releasable, carryIn, org] = await Promise.all([
      this.repo.releasableFor({ orgId: input.orgId, onOrBefore: today }),
      this.repo.carryInFor(input.orgId),
      // How this partner's commission is collected (rule #91). An `invoice`
      // org receives everything and is billed at the end of the month.
      this.repo.orgSettlement(input.orgId),
    ])

    // The hold is applied HERE, in the domain, rather than trusted to the date
    // arithmetic in the query — the query narrows, the rule decides.
    const eligible = releasable.filter((booking) => isReleasable(booking, today))
    const lines = eligible.map((booking) => toLine(booking, org.settlementMode))

    const summary = summarise(lines, carryIn)
    if (summary.direction === "none") return null

    const settlement = await this.repo.createSettlement({
      orgId: input.orgId,
      periodStart: period.start,
      periodEnd: period.end,
      grossAmount: summary.gross,
      commissionAmount: summary.commission,
      carryIn,
      netAmount: summary.net,
      direction: summary.direction,
      items: lines.map((line) => ({
        bookingId: line.bookingId,
        grossAmount: line.gross,
        commissionAmount: line.commission,
        netAmount: line.net,
      })),
    })

    // Another run got there first. Its row is the settlement; this one is not.
    if (!settlement) return null

    if (settlement.direction === "payout") await this.transfer(settlement)
    return this.repo.findById(settlement.id)
  }

  /**
   * Sends the money.
   *
   * Outside the settlement transaction, deliberately: a transfer cannot be
   * rolled back, and holding a transaction open across a bank's API is how a
   * connection pool empties.
   *
   * The settlement row already exists at this point, which is what makes a
   * failure recoverable — the bookings are recorded as settled, the money is
   * marked `failed`, and an admin can retry the transfer without the run
   * recounting a single stay.
   */
  private async transfer(payout: PayoutRow) {
    const account = await this.repo.payoutAccountFor(payout.partnerOrgId)

    if (!account || account.status !== "verified") {
      /*
       * No money leaves to an account nobody verified.
       *
       * An unverified account is a string somebody typed into a form. A
       * transfer against it lands in a stranger's bank and cannot be recalled
       * — so the settlement stands, the balance carries, and the property is
       * told to finish verification.
       */
      const reason = account
        ? "The payout account has not been verified yet."
        : "No payout account has been set up."

      await this.repo.advance({
        payoutId: payout.id,
        fromStatus: "pending",
        toStatus: "failed",
        failureReason: reason,
      })
      // The one failure a property can actually fix themselves — so it is the
      // one they most need telling about.
      await this.tellPartner(payout, account?.last4 ?? "", reason, "failed")
      return
    }

    const claimed = await this.repo.advance({
      payoutId: payout.id,
      fromStatus: "pending",
      toStatus: "processing",
      provider: this.provider.name,
    })
    // Someone else is already sending this one.
    if (!claimed) return

    const result = await this.provider.transfer({
      payoutId: payout.id,
      accountRef: account.providerAccountRef,
      amount: payout.netAmount,
      currency: account.currency,
      description: `Stayora payout ${payout.periodStart} – ${payout.periodEnd}`,
      // Derived from the payout, so a retry is the same transfer rather than a
      // second one. This key is the difference between a timeout and a
      // duplicate payment.
      idempotencyKey: `payout:${payout.id}`,
    })

    await this.repo.advance({
      payoutId: payout.id,
      fromStatus: "processing",
      toStatus: result.outcome === "paid" ? "paid" : "failed",
      providerRef: result.providerRef,
      paidAt: result.outcome === "paid" ? new Date().toISOString() : null,
      failureReason: result.failureReason ?? null,
    })

    await this.tellPartner(payout, account.last4, result.failureReason ?? null, result.outcome)
  }

  /**
   * Payment advice, either way.
   *
   * Money arriving in a bank account with no message attached is money whose
   * origin somebody has to work out from a statement line; money that did NOT
   * arrive with no message is a property wondering where their fortnight went.
   * Both are `essential` — a payout is not a preference.
   */
  private async tellPartner(
    payout: PayoutRow,
    last4: string,
    reason: string | null,
    outcome: "paid" | "failed"
  ) {
    const recipient = await this.notifications.recipientForOrg(payout.partnerOrgId)
    if (!recipient) return

    const paid = outcome === "paid"
    await this.notifications.notify({
      template: paid ? "partner_payout_sent" : "partner_payout_failed",
      subjectId: payout.id,
      userId: recipient.userId,
      toEmail: recipient.email,
      payload: {
        net: payout.netAmount,
        periodStart: payout.periodStart,
        periodEnd: payout.periodEnd,
        last4,
        reason: reason ?? "The transfer could not be completed.",
      },
      inApp: {
        title: paid ? "Your payout is on its way" : "We could not send your payout",
        message: `${payout.periodStart} to ${payout.periodEnd}`,
        href: "/extranet/finance",
      },
    })
  }

  /** Retries a settlement whose transfer failed. Admin-driven. */
  async retry(payoutId: string) {
    const payout = await this.repo.findById(payoutId)
    if (!payout) throw new NotFoundException("Payout not found")
    if (payout.status !== "failed") {
      throw new ForbiddenException(`A ${payout.status} payout cannot be retried.`)
    }

    const reset = await this.repo.advance({
      payoutId: payout.id,
      fromStatus: "failed",
      toStatus: "pending",
      failureReason: null,
    })
    if (!reset) throw new ForbiddenException("That payout was just changed by someone else")

    await this.transfer(reset)
    return this.repo.findById(payout.id)
  }

  /* ----------------------------------------------------------------- read */

  /** A partner's own settlements. Scoped to their org, never a parameter. */
  async listForPartner(user: AuthenticatedUser, limit = 24) {
    const orgId = this.orgOf(user)
    const rows = await this.repo.listForOrg(orgId, limit)
    return rows.map(toDto)
  }

  /** One settlement, broken down to the stays behind it. */
  async statementFor(payoutId: string, user: AuthenticatedUser) {
    const orgId = this.orgOf(user)
    // 404, never 403 — a 403 would confirm the payout id is real (API1).
    if (!(await this.repo.orgOwns(orgId, payoutId))) {
      throw new NotFoundException("Payout not found")
    }

    return this.buildStatement(payoutId)
  }

  /** The same statement, for an admin, without the org scope. */
  async adminStatementFor(payoutId: string) {
    const payout = await this.repo.findById(payoutId)
    if (!payout) throw new NotFoundException("Payout not found")
    return this.buildStatement(payoutId)
  }

  async listAll(query: { status?: string; orgId?: string; limit: number }) {
    const rows = await this.repo.listAll(query)
    return rows.map((row) => ({
      ...toDto(row.payout),
      orgId: row.payout.partnerOrgId,
      orgName: row.orgName,
    }))
  }

  private async buildStatement(payoutId: string) {
    const payout = await this.repo.findById(payoutId)
    if (!payout) throw new NotFoundException("Payout not found")

    const items = await this.repo.itemsFor(payoutId)
    const refs = await this.repo.bookingRefsFor(items.map((i) => i.bookingId))

    return {
      payout: toDto(payout),
      items: items.map((item) => ({
        bookingId: item.bookingId,
        // The guest-facing reference, so a property can find the stay.
        ref: refs.get(item.bookingId)?.ref ?? null,
        checkOut: refs.get(item.bookingId)?.checkOut ?? null,
        gross: item.grossAmount,
        commission: item.commissionAmount,
        net: item.netAmount,
      })),
    }
  }

  /* ------------------------------------------------------- payout account */

  /**
   * The account a property's money goes to.
   *
   * Returned without the provider reference — that is a handle on a real bank
   * account at the processor, and a settings screen needs the last four digits
   * and a name, nothing more (API3).
   */
  async accountFor(user: AuthenticatedUser) {
    const account = await this.repo.payoutAccountFor(this.orgOf(user))
    return account
      ? {
          holderName: account.holderName,
          bankName: account.bankName,
          last4: account.last4,
          currency: account.currency,
          status: account.status,
        }
      : null
  }

  async saveAccount(input: {
    user: AuthenticatedUser
    providerAccountRef: string
    holderName: string
    last4: string
    bankName: string
    currency: string
  }) {
    const orgId = this.orgOf(input.user)

    if (input.user.partner!.role !== "admin") {
      // Not a manager, and certainly not front-desk staff. Re-pointing the
      // payout account is how a compromised login becomes a bank transfer.
      throw new ForbiddenException("Only an organisation admin can change payout details")
    }

    const saved = await this.repo.upsertPayoutAccount({
      orgId,
      provider: this.provider.name,
      providerAccountRef: input.providerAccountRef,
      holderName: input.holderName,
      last4: input.last4,
      bankName: input.bankName,
      currency: input.currency,
    })

    this.logger.warn(`Payout account changed for org ${orgId} — awaiting verification`)
    return { holderName: saved.holderName, last4: saved.last4, status: saved.status }
  }

  /** Admin approval. Nothing else makes an account payable. */
  async verifyAccount(orgId: string, verified: boolean) {
    const row = await this.repo.setPayoutAccountStatus(orgId, verified ? "verified" : "disabled")
    if (!row) throw new NotFoundException("That organisation has no payout account")
    return { last4: row.last4, status: row.status }
  }

  private orgOf(user: AuthenticatedUser): string {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    return user.partner.orgId
  }
}

/**
 * The ledger's own numbers become a payout line.
 *
 * Both modes matter: the rate plan decides who RECEIVED the guest's money, and
 * the org decides how the platform collects its share (rules #91–#93). Between
 * them they say whether this booking's commission comes off the payout or goes
 * on the month's invoice.
 */
function toLine(
  booking: ReleasableBooking,
  settlementMode: "deduct" | "invoice"
): PayoutLine {
  return lineFor({
    bookingId: booking.bookingId,
    captured: booking.captured,
    refunded: booking.refunded,
    commissionAmount: booking.commissionAmount,
    commissionStatus: booking.commissionStatus,
    paymentMode: booking.paymentMode,
    settlementMode,
  })
}

/**
 * Explicit fields (API3).
 *
 * `providerRef` is absent: it is a handle on a transfer at the processor, and
 * a partner's statement screen has no use for one.
 */
function toDto(row: PayoutRow) {
  return {
    id: row.id,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    gross: row.grossAmount,
    commission: row.commissionAmount,
    carryIn: row.carryIn,
    /** Signed. Negative means the property owes the platform (rule #52). */
    net: row.netAmount,
    direction: row.direction,
    status: row.status,
    paidAt: row.paidAt,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
  }
}
