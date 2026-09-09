import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import { canSeeRevenue } from "@stayora/shared"
import type {
  CommissionReportRow,
  FinanceOverview,
  FinanceRangeInput,
  FinanceRevenueView,
  FinanceTransaction,
  MoneyTotals,
  PlatformFinanceRangeInput,
  TransactionsQueryInput,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { AnalyticsRepository } from "../analytics/analytics.repository"
import { FinanceRepository } from "./finance.repository"
import {
  FinanceReportsRepository,
  type Scope,
  type TransactionRow,
} from "./finance-reports.repository"

/**
 * The finance screens, for both audiences (rule #97).
 *
 * One implementation, two scopes — the same choice rule #84 made for
 * analytics. A partner asks about their own properties; the platform asks with
 * the scope taken off. Writing the platform's version separately would be a
 * second definition of commission, and the two would disagree the first time
 * either was touched.
 */
@Injectable()
export class FinanceReportsService {
  constructor(
    private readonly reports: FinanceReportsRepository,
    private readonly finance: FinanceRepository,
    private readonly analytics: AnalyticsRepository
  ) {}

  /* -------------------------------------------------------------- partner */

  async overview(user: AuthenticatedUser, query: FinanceRangeInput): Promise<FinanceOverview> {
    const scope = await this.partnerScope(user, query.propertyId)
    const orgId = user.partner!.orgId

    const [totals, previous, balances, settlement] = await Promise.all([
      this.reports.totals({ ...scope, from: query.from, to: query.to }),
      this.reports.totals({ ...scope, ...preceding(query.from, query.to) }),
      this.reports.openBalances(orgId),
      this.finance.orgSettlement(orgId),
    ])

    return {
      ...totals,
      previous,
      effectiveRateBps: effectiveRate(totals),
      ...balances,
      /*
       * The rate on file, beside the rate actually achieved.
       *
       * `/partner/org` deliberately withholds this: it is a settings screen,
       * and a number there that cannot be edited only invites "why not". Here
       * it is the opposite — this IS the money screen, it is already closed to
       * roles that may not see money (rule #66), and "what do I keep" cannot
       * be answered without it. `effectiveRateBps` alone will not do: a
       * partner with no bookings yet would be told they keep everything.
       */
      commissionRateBps: settlement.commissionRateBps,
      settlementMode: settlement.settlementMode as "deduct" | "invoice",
      payoutsHeld: settlement.payoutsHeld,
    }
  }

  async revenue(user: AuthenticatedUser, query: FinanceRangeInput): Promise<FinanceRevenueView> {
    const scope = await this.partnerScope(user, query.propertyId)
    return this.buildRevenue(scope, query)
  }

  async commissions(
    user: AuthenticatedUser,
    query: FinanceRangeInput
  ): Promise<CommissionReportRow[]> {
    const scope = await this.partnerScope(user, query.propertyId)
    return this.reports.commissionsByMonth({ ...scope, from: query.from, to: query.to })
  }

  async transactions(user: AuthenticatedUser, query: TransactionsQueryInput) {
    const scope = await this.partnerScope(user, query.propertyId)
    const { rows, nextCursor } = await this.reports.transactions({
      ...scope,
      from: query.from,
      to: query.to,
      limit: query.limit,
      before: query.before,
    })
    return { items: rows.map(toTransaction), nextCursor }
  }

  /* ------------------------------------------------------------- platform */

  async platformOverview(query: PlatformFinanceRangeInput): Promise<FinanceOverview> {
    const scope: Scope = { kind: "platform", orgId: query.orgId }

    const [totals, previous, balances] = await Promise.all([
      this.reports.totals({ ...scope, from: query.from, to: query.to }),
      this.reports.totals({ ...scope, ...preceding(query.from, query.to) }),
      this.reports.openBalances(query.orgId),
    ])

    /*
     * No `settlementMode` here, and that is not an omission. It is a fact
     * about ONE organisation; on a marketplace-wide screen there is no single
     * answer, and inventing one would be a claim about partners it does not
     * describe.
     */
    return {
      ...totals,
      previous,
      effectiveRateBps: effectiveRate(totals),
      ...balances,
    }
  }

  platformRevenue(query: PlatformFinanceRangeInput): Promise<FinanceRevenueView> {
    return this.buildRevenue({ kind: "platform", orgId: query.orgId }, query)
  }

  platformCommissions(query: PlatformFinanceRangeInput): Promise<CommissionReportRow[]> {
    return this.reports.commissionsByMonth({
      kind: "platform",
      orgId: query.orgId,
      from: query.from,
      to: query.to,
    })
  }

  async platformTransactions(query: TransactionsQueryInput) {
    const { rows, nextCursor } = await this.reports.transactions({
      kind: "platform",
      orgId: query.orgId,
      from: query.from,
      to: query.to,
      limit: query.limit,
      before: query.before,
    })
    return { items: rows.map(toTransaction), nextCursor }
  }

  /* ---------------------------------------------------------------- local */

  private async buildRevenue(
    scope: Scope,
    query: { from: string; to: string; granularity: "day" | "week" | "month" }
  ): Promise<FinanceRevenueView> {
    const window = { from: query.from, to: query.to }

    const [totals, points, byProperty] = await Promise.all([
      this.reports.totals({ ...scope, ...window }),
      this.reports.byPeriod({ ...scope, ...window, granularity: query.granularity }),
      this.reports.byProperty({ ...scope, ...window }),
    ])

    return { granularity: query.granularity, totals, points, byProperty }
  }

  /**
   * Which properties this caller may ask about.
   *
   * The org comes from the session; a requested `propertyId` is INTERSECTED
   * with what the caller already had rather than trusted. A property outside
   * that set is a 404 and never a 403 — a 403 confirms the id belongs to
   * somebody (API1).
   *
   * Unlike analytics, there is no `revenue: false` variant here. Analytics has
   * screens that still say something useful with the money blanked out;
   * finance IS the money, so a role that may not see it (rule #66) is refused
   * the screen rather than shown an empty one.
   */
  private async partnerScope(
    user: AuthenticatedUser,
    propertyId?: string
  ): Promise<Extract<Scope, { kind: "properties" }>> {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    if (!canSeeRevenue(user.partner.role)) {
      throw new ForbiddenException("Your role does not have access to financial reports")
    }

    const allowed = await this.analytics.scopedPropertyIds(
      user.partner.orgId,
      user.partner.propertyIds
    )

    if (propertyId) {
      if (!allowed.includes(propertyId)) throw new NotFoundException("Property not found")
      return { kind: "properties", propertyIds: [propertyId] }
    }
    return { kind: "properties", propertyIds: allowed }
  }
}

/* ============================================================== internals == */

/**
 * The window immediately before this one, the same length.
 *
 * Inclusive dates, so a 1st-to-30th window is 30 days and the preceding one
 * ends on the 31st of the month before. Off by one here shows a partner a
 * growth figure against 29 days of trading.
 */
function preceding(from: string, to: string): { from: string; to: string } {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  const span = end - start + 86_400_000
  return {
    from: new Date(start - span).toISOString().slice(0, 10),
    to: new Date(end - span).toISOString().slice(0, 10),
  }
}

/** What the platform actually took, in basis points. Zero on zero gross. */
function effectiveRate(totals: MoneyTotals): number {
  return totals.gross > 0 ? Math.round((totals.commission / totals.gross) * 10_000) : 0
}

function toTransaction(row: TransactionRow): FinanceTransaction {
  /*
   * A voided commission is reported as zero rather than as its original
   * amount. The platform gave it up on a goodwill refund (rule #76) and the
   * partner does not owe it — a ledger still showing the charge is a ledger
   * the partner will query.
   */
  const commission = row.commission_status === "void" ? 0 : row.commission_raw
  return {
    bookingId: row.booking_id,
    ref: row.ref,
    bookedAt: row.booked_at,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guestName: row.guest_name,
    propertyId: row.property_id,
    propertyName: row.property_name,
    roomName: row.room_name,
    gross: row.gross,
    commission,
    net: row.gross - commission,
    refunded: row.refunded,
    paymentMode: row.payment_mode as FinanceTransaction["paymentMode"],
    source: row.source,
    status: row.status,
  }
}
