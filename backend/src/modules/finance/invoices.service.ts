import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import {
  formatTicketRef,
  INVOICE_DUE_DAYS,
  isOverdue,
  summariseInvoice,
  type InvoiceLine,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { NotificationsService } from "../notifications/notifications.service"
import { AuditService } from "../admin/audit.service"
import { FinanceRepository } from "./finance.repository"

/**
 * The monthly commission bill (rules #91–#95).
 *
 * Separate from `FinanceService`, which pays money OUT. This one asks for it
 * back, and the two run on different cycles — payouts fortnightly (rule #48),
 * invoices monthly. Paying somebody and billing them do not have to happen on
 * the same day, and a monthly bill is what an accounts department reads.
 */
@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name)

  constructor(
    private readonly repo: FinanceRepository,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService
  ) {}

  /* --------------------------------------------------------------- the run */

  /**
   * Bills every partner for a month.
   *
   * Safe to run twice, at two levels. `billableFor` excludes anything already
   * on a line, and a UNIQUE index on `(partner_org_id, period_start)` refuses
   * a second invoice for the same month outright — a cron that fires twice, a
   * retry, or somebody running it by hand all hit the same wall.
   */
  async runForMonth(input: { periodStart: string; periodEnd: string }) {
    const orgs = await this.repo.orgsToBill()
    const issued: { orgId: string; invoiceId: string; amount: number }[] = []

    for (const org of orgs) {
      try {
        const invoice = await this.billOrg({ ...input, orgId: org.id, orgName: org.name })
        if (invoice) issued.push(invoice)
      } catch (error) {
        /*
         * One partner's failure must not stop the run.
         *
         * A duplicate-period conflict is the normal outcome of a re-run and is
         * expected; anything else is logged and the next org is billed. A
         * month where nobody was invoiced because org three had a bad row is
         * far worse than a month where org three was missed.
         */
        this.logger.warn(`Could not bill ${org.name}: ${(error as Error).message}`)
      }
    }

    return { issued: issued.length, invoices: issued }
  }

  /**
   * One partner's month.
   *
   * Returns `null` when there is nothing to bill — no invoice is written for a
   * zero amount. A bill for nothing is noise a partner learns to ignore, and
   * the one month they owe something it looks like all the others.
   */
  private async billOrg(input: {
    orgId: string
    orgName: string
    periodStart: string
    periodEnd: string
  }) {
    const settlement = await this.repo.orgSettlement(input.orgId)

    /*
     * Only `invoice` orgs are billed here.
     *
     * A `deduct` org has its commission taken from each payout, and whatever a
     * cycle cannot cover is carried into the next one (rule #50) rather than
     * billed. Invoicing them as well would charge the same commission twice.
     */
    if (settlement.settlementMode !== "invoice") return null

    const billable = await this.repo.billableFor({
      orgId: input.orgId,
      from: input.periodStart,
      to: input.periodEnd,
    })
    if (billable.length === 0) return null

    const lines: InvoiceLine[] = billable.map((row) => ({
      bookingId: row.bookingId,
      ref: row.ref,
      total: row.total,
      commission: row.commission,
    }))
    const summary = summariseInvoice(lines)
    if (summary.amount <= 0) return null

    const invoice = await this.repo.createInvoice({
      invoice: {
        ref: await this.nextRef(input.periodStart),
        partnerOrgId: input.orgId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        grossAmount: summary.gross,
        amount: summary.amount,
        bookingCount: summary.bookings,
        dueDate: addDays(input.periodEnd, INVOICE_DUE_DAYS),
      },
      lines: lines.map((line) => ({
        bookingId: line.bookingId,
        bookingRef: line.ref,
        total: line.total,
        commission: line.commission,
      })),
    })

    const recipient = await this.notifications.recipientForOrg(input.orgId)
    if (recipient) {
      await this.notifications.notify({
        template: "invoice_issued",
        subjectId: invoice.id,
        userId: recipient.userId,
        toEmail: recipient.email,
        payload: {
          ref: invoice.ref,
          amount: invoice.amount,
          bookings: summary.bookings,
          dueDate: invoice.dueDate,
        },
      })
    }

    return { orgId: input.orgId, invoiceId: invoice.id, amount: invoice.amount }
  }

  /* ------------------------------------------------------------- overdue -- */

  /**
   * What an unpaid invoice costs (rule #95).
   *
   * The org drops back to `deduct` — new bookings have the commission held
   * back again — and its payouts stop until the balance clears.
   *
   * The listing stays up, deliberately. A guest who booked has done nothing
   * wrong, and pulling the property punishes them for the partner's bill.
   */
  async sweepOverdue(today = new Date().toISOString().slice(0, 10)) {
    const overdue = await this.repo.overdueInvoices(today)
    const acted: string[] = []

    for (const invoice of overdue) {
      if (!isOverdue({ dueDate: invoice.dueDate, today, state: "issued" })) continue

      await this.repo.updateInvoice(invoice.id, { status: "overdue" })
      await this.repo.setOrgSettlement(invoice.partnerOrgId, {
        settlementMode: "deduct",
        payoutsHeld: true,
      })
      acted.push(invoice.id)

      const recipient = await this.notifications.recipientForOrg(invoice.partnerOrgId)
      if (recipient) {
        await this.notifications.notify({
          template: "invoice_overdue",
          subjectId: invoice.id,
          userId: recipient.userId,
          toEmail: recipient.email,
          payload: { ref: invoice.ref, amount: invoice.amount, dueDate: invoice.dueDate },
        })
      }
    }

    return { marked: acted.length }
  }

  /* -------------------------------------------------------------- reading -- */

  async listForOrg(user: AuthenticatedUser) {
    if (!user.partner) throw new BadRequestException("This account is not linked to a property")
    return this.repo.listInvoices({ orgId: user.partner.orgId, limit: 100 })
  }

  /**
   * One invoice, with the working shown.
   *
   * Every line, not just the total. A bill a partner cannot check against
   * their own records is one they query rather than pay.
   */
  async detail(input: { invoiceId: string; user: AuthenticatedUser }) {
    const invoice = await this.repo.findInvoice(input.invoiceId)
    // 404, never 403 — a 403 confirms the invoice id belongs to somebody (API1).
    if (!invoice) throw new NotFoundException("Invoice not found")

    const isAdmin = input.user.role === "admin"
    if (!isAdmin && invoice.partnerOrgId !== input.user.partner?.orgId) {
      throw new NotFoundException("Invoice not found")
    }

    const lines = await this.repo.invoiceLines(invoice.id)
    return { invoice, lines }
  }

  async listAll(query: { orgId?: string; status?: string; limit: number }) {
    const rows = await this.repo.listInvoicesWithOrg(query)
    return rows.map((row) => ({ ...row.invoice, orgName: row.orgName }))
  }

  /**
   * Marking an invoice paid.
   *
   * The platform's word, not the partner's: money arrives by bank transfer and
   * somebody reconciles it. Payouts resume only when NOTHING is outstanding —
   * clearing one of three unpaid invoices should not release the money.
   */
  async markPaid(input: { invoiceId: string; note: string }) {
    const invoice = await this.repo.findInvoice(input.invoiceId)
    if (!invoice) throw new NotFoundException("Invoice not found")
    if (invoice.status === "paid") return invoice

    const updated = await this.repo.updateInvoice(invoice.id, {
      status: "paid",
      paidAt: new Date().toISOString(),
      paymentNote: input.note,
    })

    const stillOwes = await this.repo.hasUnpaidInvoices(invoice.partnerOrgId)
    if (!stillOwes) {
      await this.repo.setOrgSettlement(invoice.partnerOrgId, { payoutsHeld: false })
    }

    return updated!
  }

  /**
   * Moving a partner between collection modes (rules #91, #92).
   *
   * `invoice` is a privilege the platform grants, never something a partner
   * switches on: it means handing over money and asking for a share back, and
   * if they do not pay, the platform has already paid.
   *
   * Refused while anything is outstanding. Granting invoice terms to somebody
   * who has not settled their last bill is how the exposure compounds.
   */
  async setMode(input: {
    orgId: string
    mode: "deduct" | "invoice"
    reason: string
    user: AuthenticatedUser
    ip?: string | null
  }) {
    if (input.mode === "invoice") {
      const owes = await this.repo.hasUnpaidInvoices(input.orgId)
      if (owes) {
        throw new BadRequestException(
          "This partner has unpaid invoices. Settle them before granting invoice terms."
        )
      }
    }

    const updated = await this.repo.setOrgSettlement(input.orgId, {
      settlementMode: input.mode,
      // Moving somebody back to `deduct` by hand clears the hold that rule #95
      // put there — the reason for it has just been dealt with.
      ...(input.mode === "deduct" ? { payoutsHeld: false } : {}),
    })
    if (!updated) throw new NotFoundException("Organisation not found")

    await this.audit.record({
      actor: input.user,
      action: "partner_org.settlement_mode",
      subjectType: "partner_org",
      subjectId: input.orgId,
      reason: input.reason,
      metadata: { mode: input.mode },
      ip: input.ip,
    })

    return updated
  }

  /* ----------------------------------------------------------------- local */

  /**
   * `INV-2026-08-000123` — the period is in the reference deliberately.
   *
   * A partner filing bills wants the month on the document, and support asked
   * about "the August invoice" should be able to find it by name. The sequence
   * is shared with tickets, which costs nothing: both are references nobody
   * should be able to guess the next of.
   */
  private async nextRef(periodStart: string): Promise<string> {
    const ticketish = await this.repo.nextSequence()
    const month = periodStart.slice(0, 7)
    return `INV-${month}-${formatTicketRef(ticketish).slice(4)}`
  }
}

/** Whole days, on dates — no clock arithmetic near a due date. */
function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
