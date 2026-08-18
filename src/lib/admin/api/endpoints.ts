/**
 * The typed admin API surface.
 *
 * Components never import from `src/data/admin` directly — they call these
 * endpoints through the react-query hooks in `hooks.ts`. Swapping in a real
 * backend means reimplementing `request()` in `transport.ts`; these signatures
 * are the contract.
 */

import {
  adminAnalyticsRows,
  adminAuditEvents,
  adminCommissionRows,
  adminDemandCities,
  adminRevenueRows,
  analyticsSeries,
  clientById,
  dashboardSeries,
  dashboardSeriesYear,
  dashboardStats,
  financeStats,
  platformAvgAdr,
  platformAvgOccupancy,
  propertiesForClient,
  propertyDetail,
  taxRuleForCountry,
  totalBookingsYtd,
  totalRevenueYtd,
  COMMISSION_RATE,
} from "@/data/admin"
import type {
  AuditCategory,
  AuditEvent,
  Cancellation,
  Client,
  CommissionInvoice,
  ContentItem,
  Guest,
  GuestStatus,
  InboxThread,
  InvoicePreview,
  Manager,
  ManagerRole,
  Payout,
  PlatformSettings,
  Promotion,
  Property,
  PropertyDetail,
  PropertyStatus,
  Reservation,
  Review,
  ReviewStatus,
} from "@/lib/admin/types"

import { db } from "./store"
import {
  ApiError,
  NotFoundError,
  applyListParams,
  request,
  type ListParams,
} from "./transport"

export { ApiError, NotFoundError }
export type { ListParams }

/* ------------------------------------------------------------ counts */

/**
 * Every derived count, read from the *mutable* store.
 *
 * The fixtures in `data/admin` are the immutable seed, so counts computed there
 * freeze at module load — suspending a guest would update the table but not the
 * tiles above it. Screens and the sidebar read these instead, and mutations
 * invalidate them, so the numbers stay in agreement after writes as well as
 * before.
 */
export const countsApi = {
  all: () =>
    request(
      () => {
        const by = <T,>(rows: T[], pick: (row: T) => string) =>
          rows.reduce<Record<string, number>>((acc, row) => {
            const key = pick(row)
            acc[key] = (acc[key] ?? 0) + 1
            return acc
          }, {})

        const properties = by(db.properties, (p) => p.status)
        const guests = by(db.guests, (g) => g.status)
        const managers = by(db.managers, (m) => m.status)
        const reviews = by(db.reviews, (r) => r.status)
        const content = by(db.content, (c) => c.status)
        const promotions = by(db.promotions, (p) => p.status)
        const reservations = by(db.reservations, (r) => r.status)
        const payouts = by(db.payouts, (p) => p.status)
        const commissionInvoices = by(db.commissionInvoices, (i) => i.status)
        const cancellations = by(db.cancellations, (c) => c.reason)
        const refunds = by(db.cancellations, (c) => c.refund)
        const clients = by(db.clients, (c) => c.status)
        const plans = by(db.clients, (c) => c.plan)
        const roles = by(db.managers, (m) => m.role)
        const sources = by(db.reservations, (r) => r.source)

        const propertiesPerClient = db.clients.reduce<Record<string, number>>(
          (acc, client) => {
            acc[client.name] = db.properties.filter(
              (p) => p.clientId === client.id
            ).length
            return acc
          },
          {}
        )
        const managersPerClient = db.clients.reduce<Record<string, number>>(
          (acc, client) => {
            acc[client.name] = db.managers.filter(
              (m) => m.clientId === client.id
            ).length
            return acc
          },
          {}
        )

        const activePromoBookings = db.promotions
          .filter((p) => p.status === "Active")
          .reduce((sum, p) => sum + p.bookings, 0)

        const unpaidBilling = db.billingInvoices.filter(
          (i) => i.status !== "Paid"
        )

        return {
          totals: {
            clients: db.clients.length,
            guests: db.guests.length,
            properties: db.properties.length,
            managers: db.managers.length,
            reservations: db.reservations.length,
            cancellations: db.cancellations.length,
            reviews: db.reviews.length,
            content: db.content.length,
            promotions: db.promotions.length,
            payouts: db.payouts.length,
            commissionInvoices: db.commissionInvoices.length,
            subscriptions: db.billingInvoices.length,
          },
          properties,
          guests,
          managers,
          reviews,
          content,
          promotions,
          reservations,
          payouts,
          commissionInvoices,
          cancellations,
          refunds,
          clients,
          plans,
          roles,
          sources,
          propertiesPerClient,
          managersPerClient,
          activePromoBookings,
          money: {
            payoutsPaid: db.payouts
              .filter((p) => p.status === "Paid")
              .reduce((sum, p) => sum + p.amount, 0),
            payoutsPending: db.payouts
              .filter((p) => p.status === "Pending")
              .reduce((sum, p) => sum + p.amount, 0),
            propertiesPaid: new Set(
              db.payouts.filter((p) => p.status === "Paid").map((p) => p.propertyId)
            ).size,
            refunded: db.cancellations.reduce(
              (sum, c) => sum + c.refundAmount,
              0
            ),
            retained: db.cancellations.reduce(
              (sum, c) => sum + (c.originalTotal - c.refundAmount),
              0
            ),
            overdueBilling: db.billingInvoices
              .filter((i) => i.status === "Overdue")
              .reduce((sum, i) => sum + i.amount, 0),
          },
          badges: {
            propertiesPending: properties.Pending ?? 0,
            usersInvited: managers.Invited ?? 0,
            reservations: db.reservations.length,
            inboxUnread: db.threads.filter((t) => t.unread).length,
            reviewsToModerate:
              (reviews.Flagged ?? 0) + (reviews["Pending Review"] ?? 0),
            contentToModerate:
              (content.Flagged ?? 0) + (content["Pending Review"] ?? 0),
            billingUnpaid: unpaidBilling.length,
          },
        }
      },
      // Counts back the chrome; keep them snappy and never fail them.
      { delay: 80, failureRate: 0 }
    ),
}

export type AdminCounts = Awaited<ReturnType<typeof countsApi.all>>

/* ---------------------------------------------------------- overview */

export const overviewApi = {
  /**
   * Everything `/admin` renders, in one round trip.
   *
   * The tile *values* are recomputed from `db` on every call — the seed's
   * `dashboardStats` supplies only the labels, icons and period-over-period
   * deltas, which are editorial and not derivable from a snapshot. Returning
   * the seed object wholesale would freeze "Active Reservations" and "Pending
   * Approvals" no matter what an admin did.
   */
  summary: (range: "6M" | "1Y" = "6M") =>
    request(() => {
      const live: Record<string, string> = {
        "Total Clients": String(db.clients.length),
        "Total Properties": String(db.properties.length),
        "Active Reservations": String(
          db.reservations.filter((r) =>
            ["Pending", "Confirmed", "Checked In"].includes(r.status)
          ).length
        ),
        "Pending Approvals": String(
          db.properties.filter((p) => p.status === "Pending").length +
            db.content.filter(
              (c) => c.status === "Flagged" || c.status === "Pending Review"
            ).length +
            db.reviews.filter(
              (r) => r.status === "Flagged" || r.status === "Pending Review"
            ).length +
            db.managers.filter((m) => m.status === "Invited").length +
            db.commissionInvoices.filter((i) => i.status === "Overdue").length
        ),
        "Support Tickets": String(
          db.threads.filter((t) => t.kind === "ticket" && t.status !== "Resolved")
            .length
        ),
      }

      return {
        stats: dashboardStats.map((stat) =>
          live[stat.label] ? { ...stat, value: live[stat.label] } : stat
        ),
        series: range === "1Y" ? dashboardSeriesYear : dashboardSeries,
        activity: auditRows().slice(0, 6),
        clients: db.clients.map((client) => ({
          client,
          properties: db.properties.filter((p) => p.clientId === client.id)
            .length,
        })),
      }
    }),

  /** The six tiles shared by every Finance tab. */
  financeSummary: () =>
    request(() => {
      // Outstanding invoices must track issuing and payment, otherwise the
      // Invoices tab's live facet counts disagree with the tile above them.
      const outstanding = db.commissionInvoices
        .filter((i) => i.status === "Pending" || i.status === "Overdue")
        .reduce((sum, i) => sum + i.total, 0)

      return {
        stats: financeStats.map((stat) =>
          stat.label === "Outstanding Invoices"
            ? { ...stat, value: `$${(outstanding / 1000).toFixed(1)}K` }
            : stat
        ),
        revenue: adminRevenueRows,
        commissions: adminCommissionRows,
      }
    }),

  /** Cross-client analytics. */
  analyticsSummary: () =>
    request(() => ({
      rows: adminAnalyticsRows,
      series: analyticsSeries,
      demand: adminDemandCities,
      totals: {
        clients: db.clients.length,
        properties: db.properties.length,
        bookings: totalBookingsYtd,
        revenue: totalRevenueYtd,
        occupancy: platformAvgOccupancy,
        adr: platformAvgAdr,
      },
    })),
}

/* ----------------------------------------------------------- clients */

export const clientsApi = {
  list: (params: ListParams = {}) =>
    request(() =>
      applyListParams(db.clients, params, {
        searchFields: (c) => [c.name, c.contactPerson, c.email, c.country],
        sortValue: (c, key) =>
          (c[key as keyof Client] as string | number) ?? "",
      })
    ),

  get: (id: string) =>
    request(() => {
      const client = db.clients.find((c) => c.id === id)
      if (!client) throw new NotFoundError(`Client ${id}`)
      return {
        client,
        properties: db.properties.filter((p) => p.clientId === id),
        managers: db.managers.filter((m) => m.clientId === id),
        subscription: db.billingInvoices.filter((i) => i.clientId === id),
      }
    }),
}

/* ------------------------------------------------------------ guests */

export const guestsApi = {
  list: (params: ListParams = {}) =>
    request(() =>
      applyListParams(db.guests, params, {
        searchFields: (g) => [g.name, g.email, g.phone, g.country, g.id],
        sortValue: (g, key) => (g[key as keyof Guest] as string | number) ?? "",
      })
    ),

  get: (id: string) =>
    request(() => {
      const guest = db.guests.find((g) => g.id === id)
      if (!guest) throw new NotFoundError(`Guest ${id}`)
      return {
        guest,
        reservations: db.reservations.filter(
          (r) => r.guestEmail === guest.email
        ),
      }
    }),

  setStatus: (id: string, status: GuestStatus, reason: string) =>
    request(() => {
      const guest = db.guests.find((g) => g.id === id)
      if (!guest) throw new NotFoundError(`Guest ${id}`)
      guest.status = status
      recordAudit({
        action: `Guest ${status.toLowerCase()}`,
        targetName: guest.name,
        targetKind: "Guest",
        details: reason,
        category: "User",
      })
      return guest
    }),
}

/* -------------------------------------------------------- properties */

export const propertiesApi = {
  list: (params: ListParams = {}) =>
    request(() =>
      applyListParams(db.properties, params, {
        searchFields: (p) => [
          p.name,
          p.id,
          p.city,
          p.country,
          clientById(p.clientId)?.name ?? "",
        ],
        sortValue: (p, key) => {
          if (key === "client") return clientById(p.clientId)?.name ?? ""
          if (key === "location") return `${p.city}, ${p.country}`
          return (p[key as keyof Property] as string | number) ?? ""
        },
        filterValue: (p, key) =>
          key === "client"
            ? (clientById(p.clientId)?.name ?? "")
            : String(p[key as keyof Property] ?? ""),
      })
    ),

  get: (id: string): Promise<PropertyDetail> =>
    request(() => {
      const live = db.properties.find((p) => p.id === id)
      if (!live) throw new NotFoundError(`Property ${id}`)
      // Derive from the LIVE row, so room occupancy and verification state
      // follow mutations rather than freezing at the seed's initial status.
      const detail = propertyDetail(id, live)
      if (!detail) throw new NotFoundError(`Property ${id}`)
      return { ...detail, decision: db.propertyDecisions[id] ?? null }
    }),

  /**
   * Transitions a property through the approval lifecycle. Rejects illegal
   * transitions rather than silently applying them — the Figma allowed
   * Approve, Request Changes and Re-approve to render simultaneously.
   */
  transition: (id: string, next: PropertyStatus, note?: string) =>
    request(() => {
      const property = db.properties.find((p) => p.id === id)
      if (!property) throw new NotFoundError(`Property ${id}`)

      if (!allowedTransitions(property.status).includes(next)) {
        throw new ApiError(
          `A ${property.status.toLowerCase()} property cannot move to ${next.toLowerCase()}.`,
          409,
          "invalid_transition"
        )
      }

      const from = property.status
      property.status = next
      if (next === "Suspended" || next === "Rejected") {
        property.occupancy = 0
        property.revenueToday = 0
      }

      // Record who decided, so the approval panel can show it back. States
      // awaiting a decision clear it rather than showing a stale one.
      db.propertyDecisions[id] =
        next === "Pending" || next === "Draft"
          ? null
          : {
              by: "Ahmed Khan",
              at: new Date().toISOString().slice(0, 10),
              note,
            }

      recordAudit({
        action: `Property ${next.toLowerCase()}`,
        targetName: property.name,
        targetKind: "Property",
        details: note ?? `${property.id} moved from ${from} to ${next}`,
        category: "Property",
      })
      return property
    }),
}

/** The state machine agreed in Phase 1 (decision D6). */
export function allowedTransitions(status: PropertyStatus): PropertyStatus[] {
  switch (status) {
    case "Draft":
      return ["Pending"]
    case "Pending":
      return ["Active", "Rejected", "Changes Requested"]
    case "Changes Requested":
      return ["Pending", "Rejected"]
    case "Rejected":
      return ["Pending"]
    case "Active":
      return ["Suspended"]
    case "Suspended":
      return ["Active"]
    default:
      return []
  }
}

/* ---------------------------------------------------------- managers */

export const managersApi = {
  list: (params: ListParams = {}) =>
    request(() =>
      applyListParams(db.managers, params, {
        searchFields: (m) => [
          m.name,
          m.email,
          clientById(m.clientId)?.name ?? "",
          m.role,
        ],
        sortValue: (m, key) => {
          if (key === "client") return clientById(m.clientId)?.name ?? ""
          if (key === "lastLogin") return m.lastLogin ?? ""
          return (m[key as keyof Manager] as string | number) ?? ""
        },
        filterValue: (m, key) =>
          key === "client"
            ? (clientById(m.clientId)?.name ?? "")
            : String(m[key as keyof Manager] ?? ""),
      })
    ),

  invite: (input: { email: string; role: ManagerRole; clientId: string }) =>
    request(() => {
      if (db.managers.some((m) => m.email === input.email)) {
        throw new ApiError(
          "A manager with that email already exists.",
          409,
          "duplicate_email"
        )
      }
      const client = clientById(input.clientId)
      if (!client) throw new NotFoundError(`Client ${input.clientId}`)

      const manager: Manager = {
        id: `MGR-${String(db.managers.length + 1).padStart(3, "0")}`,
        name: input.email.split("@")[0].replace(/[._]/g, " "),
        email: input.email,
        role: input.role,
        clientId: input.clientId,
        propertyIds: propertiesForClient(input.clientId).map((p) => p.id),
        status: "Invited",
        lastLogin: null,
        seed: input.email,
      }
      db.managers.unshift(manager)

      recordAudit({
        action: "Manager invited",
        targetName: manager.email,
        targetKind: "Manager",
        details: `Invited as ${input.role} for ${client.name}`,
        category: "User",
      })
      return manager
    }),

  setStatus: (id: string, status: Manager["status"]) =>
    request(() => {
      const manager = db.managers.find((m) => m.id === id)
      if (!manager) throw new NotFoundError(`Manager ${id}`)
      manager.status = status
      recordAudit({
        action: `Manager ${status.toLowerCase()}`,
        targetName: manager.name,
        targetKind: "Manager",
        details: `${manager.email} is now ${status}`,
        category: "User",
      })
      return manager
    }),
}

/* ------------------------------------------------------ reservations */

export const reservationsApi = {
  list: (params: ListParams = {}) =>
    request(() =>
      applyListParams(db.reservations, params, {
        searchFields: (r) => [
          r.id,
          r.guestName,
          r.guestEmail,
          r.room,
          propertyName(r.propertyId),
        ],
        sortValue: (r, key) => {
          if (key === "property") return propertyName(r.propertyId)
          return (r[key as keyof Reservation] as string | number) ?? ""
        },
        filterValue: (r, key) => {
          if (key === "client") return clientNameFor(r.propertyId)
          return String(r[key as keyof Reservation] ?? "")
        },
      })
    ),

  get: (id: string) =>
    request(() => {
      const reservation = db.reservations.find((r) => r.id === id)
      if (!reservation) throw new NotFoundError(`Reservation ${id}`)
      return reservation
    }),

  cancel: (id: string, reason: Cancellation["reason"], note: string) =>
    request(() => {
      const reservation = db.reservations.find((r) => r.id === id)
      if (!reservation) throw new NotFoundError(`Reservation ${id}`)
      if (["Cancelled", "Checked Out"].includes(reservation.status)) {
        throw new ApiError(
          `${reservation.id} is already ${reservation.status.toLowerCase()}.`,
          409,
          "invalid_transition"
        )
      }

      reservation.status = "Cancelled"
      db.cancellations.unshift({
        id: `CXL-${4025 + db.cancellations.length}`,
        reservationId: reservation.id,
        guestName: reservation.guestName,
        propertyId: reservation.propertyId,
        cancelledAt: new Date().toISOString().slice(0, 10),
        reason,
        refund: reason === "Guest request" ? "Full refund" : "No refund",
        refundAmount: reason === "Guest request" ? reservation.total : 0,
        originalTotal: reservation.total,
        cancelledBy: "Ahmed Khan (Super Admin)",
        note,
      })

      recordAudit({
        action: "Reservation cancelled",
        targetName: reservation.id,
        targetKind: "Reservation",
        details: `${reason} — ${note}`,
        category: "Billing",
      })
      return reservation
    }),
}

export const cancellationsApi = {
  list: (params: ListParams = {}) =>
    request(() =>
      applyListParams(db.cancellations, params, {
        searchFields: (c) => [
          c.id,
          c.reservationId,
          c.guestName,
          propertyName(c.propertyId),
          c.reason,
        ],
        sortValue: (c, key) => {
          if (key === "property") return propertyName(c.propertyId)
          return (c[key as keyof Cancellation] as string | number) ?? ""
        },
      })
    ),
}

/* ------------------------------------------------------------- inbox */

export const inboxApi = {
  list: (kind?: InboxThread["kind"]) =>
    request(() =>
      kind ? db.threads.filter((t) => t.kind === kind) : [...db.threads]
    ),

  /** Pure read — marking read is a separate mutation so caches can invalidate. */
  get: (id: string) =>
    request(() => {
      const thread = db.threads.find((t) => t.id === id)
      if (!thread) throw new NotFoundError(`Conversation ${id}`)
      return thread
    }),

  markRead: (id: string) =>
    request(() => {
      const thread = db.threads.find((t) => t.id === id)
      if (!thread) throw new NotFoundError(`Conversation ${id}`)
      thread.unread = false
      return thread
    }),

  reply: (id: string, body: string) =>
    request(() => {
      const thread = db.threads.find((t) => t.id === id)
      if (!thread) throw new NotFoundError(`Conversation ${id}`)
      thread.messages.push({
        id: `M${thread.messages.length + 1}`,
        author: "Ahmed Khan",
        authorRole: "admin",
        at: new Date().toISOString(),
        body,
      })
      thread.updatedAt = new Date().toISOString()
      if (thread.status === "Open") thread.status = "In Progress"
      return thread
    }),

  setStatus: (id: string, status: InboxThread["status"]) =>
    request(() => {
      const thread = db.threads.find((t) => t.id === id)
      if (!thread) throw new NotFoundError(`Conversation ${id}`)
      thread.status = status
      return thread
    }),
}

/* ----------------------------------------------------------- reviews */

export const reviewsApi = {
  list: (params: ListParams = {}) =>
    request(() =>
      applyListParams(db.reviews, params, {
        searchFields: (r) => [
          r.guestName,
          r.title,
          r.body,
          propertyName(r.propertyId),
        ],
        sortValue: (r, key) => {
          if (key === "property") return propertyName(r.propertyId)
          return (r[key as keyof Review] as string | number) ?? ""
        },
      })
    ),

  setStatus: (id: string, status: ReviewStatus, reason?: string) =>
    request(() => {
      const review = db.reviews.find((r) => r.id === id)
      if (!review) throw new NotFoundError(`Review ${id}`)
      review.status = status
      if (status === "Published") review.flagReason = null
      recordAudit({
        action: `Review ${status.toLowerCase()}`,
        targetName: `${review.id} (${propertyName(review.propertyId)})`,
        targetKind: "Review",
        details: reason ?? `Moderated to ${status}`,
        category: "Content",
      })
      return review
    }),
}

/* ----------------------------------------------------------- finance */

export const financeApi = {
  payouts: (params: ListParams = {}) =>
    request(() =>
      applyListParams(db.payouts, params, {
        searchFields: (p) => [
          p.id,
          p.ownerName,
          p.reference,
          propertyName(p.propertyId),
        ],
        sortValue: (p, key) => {
          if (key === "property") return propertyName(p.propertyId)
          return (p[key as keyof Payout] as string | number) ?? ""
        },
      })
    ),

  retryPayout: (id: string) =>
    request(() => {
      const payout = db.payouts.find((p) => p.id === id)
      if (!payout) throw new NotFoundError(`Payout ${id}`)
      if (payout.status !== "Failed") {
        throw new ApiError(
          "Only failed payouts can be retried.",
          409,
          "invalid_transition"
        )
      }
      payout.status = "Pending"
      payout.failureReason = null
      recordAudit({
        action: "Payout retried",
        targetName: payout.id,
        targetKind: "Payout",
        details: `Re-queued ${payout.reference} for ${propertyName(payout.propertyId)}`,
        category: "Billing",
      })
      return payout
    }),

  invoices: (params: ListParams = {}) =>
    request(() =>
      applyListParams(db.commissionInvoices, params, {
        searchFields: (i) => [i.id, i.ownerName, propertyName(i.propertyId)],
        sortValue: (i, key) => {
          if (key === "property") return propertyName(i.propertyId)
          return (i[key as keyof CommissionInvoice] as string | number) ?? ""
        },
      })
    ),

  /** Step 1 of the Generate Invoice dialog — computes the preview. */
  previewInvoice: (input: {
    invoiceNumber: string
    propertyId: string
    periodStart: string
    periodEnd: string
    notes: string
  }): Promise<InvoicePreview> =>
    request(() => {
      const property = db.properties.find((p) => p.id === input.propertyId)
      if (!property) throw new NotFoundError(`Property ${input.propertyId}`)

      const start = new Date(input.periodStart)
      const end = new Date(input.periodEnd)
      const nights = Math.max(
        1,
        Math.round((end.getTime() - start.getTime()) / 86_400_000)
      )

      const transactions = Math.max(
        1,
        Math.round((property.rooms * (property.occupancy / 100) * nights) / 3)
      )
      const grossRevenue = Math.round(transactions * property.adr)
      const subtotal = Math.round(grossRevenue * COMMISSION_RATE)
      const rule = taxRuleForCountry(property.country)
      const taxRate = Number.parseFloat(rule.rate) / 100
      const taxAmount = Math.round(subtotal * taxRate)

      return {
        invoiceNumber: input.invoiceNumber,
        propertyId: property.id,
        ownerName: clientById(property.clientId)?.contactPerson ?? "—",
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        transactions,
        grossRevenue,
        commissionRate: COMMISSION_RATE,
        subtotal,
        taxRate,
        taxLabel: rule.name,
        taxAmount,
        total: subtotal + taxAmount,
        notes: input.notes,
      }
    }),

  /** Step 2 — issues the previewed invoice. */
  issueInvoice: (preview: InvoicePreview) =>
    request(() => {
      if (db.commissionInvoices.some((i) => i.id === preview.invoiceNumber)) {
        throw new ApiError(
          `Invoice ${preview.invoiceNumber} already exists.`,
          409,
          "duplicate_invoice"
        )
      }
      const issued = new Date()
      const due = new Date(issued.getTime() + 7 * 86_400_000)

      const invoice: CommissionInvoice = {
        id: preview.invoiceNumber,
        propertyId: preview.propertyId,
        ownerName: preview.ownerName,
        subtotal: preview.subtotal,
        taxRate: preview.taxRate,
        taxLabel: preview.taxLabel,
        total: preview.total,
        issued: issued.toISOString().slice(0, 10),
        due: due.toISOString().slice(0, 10),
        status: "Pending",
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        bookings: preview.transactions,
      }
      db.commissionInvoices.unshift(invoice)

      recordAudit({
        action: "Invoice issued",
        targetName: invoice.id,
        targetKind: "Invoice",
        details: `Commission invoice for ${propertyName(invoice.propertyId)}: $${invoice.subtotal.toLocaleString("en-US")} subtotal, ${invoice.bookings} bookings`,
        category: "Billing",
      })
      return invoice
    }),
}

/* ----------------------------------------------------------- content */

export const contentApi = {
  list: (params: ListParams = {}) =>
    request(() =>
      applyListParams(db.content, params, {
        searchFields: (c) => [propertyName(c.propertyId), c.body],
        sortValue: (c, key) =>
          (c[key as keyof ContentItem] as string | number) ?? "",
      })
    ),

  setStatus: (id: string, status: ContentItem["status"], reason?: string) =>
    request(() => {
      const item = db.content.find((c) => c.id === id)
      if (!item) throw new NotFoundError(`Description ${id}`)
      item.status = status
      item.flagReason = status === "Flagged" ? (reason ?? item.flagReason) : null
      item.updatedAt = new Date().toISOString().slice(0, 10)
      recordAudit({
        action: `Description ${status.toLowerCase()}`,
        targetName: propertyName(item.propertyId),
        targetKind: "Description",
        details: reason ?? `Content score: ${item.score}`,
        category: "Content",
      })
      return item
    }),

  update: (id: string, body: string) =>
    request(() => {
      const item = db.content.find((c) => c.id === id)
      if (!item) throw new NotFoundError(`Description ${id}`)
      item.body = body
      item.updatedAt = new Date().toISOString().slice(0, 10)
      item.status = "Pending Review"
      // The old flag described the old copy — leaving it would show a stale
      // "placeholder text" warning under a freshly rewritten description.
      item.flagReason = null
      return item
    }),
}

/* -------------------------------------------------------- promotions */

export const promotionsApi = {
  list: (city?: string) =>
    request(() =>
      city && city !== "All"
        ? db.promotions.filter((p) => p.city === city)
        : [...db.promotions]
    ),

  /** Live-and-scheduled campaigns ranked by discount depth. */
  rankings: () =>
    request(() =>
      db.promotions
        .filter((p) => p.status === "Active" || p.status === "Scheduled")
        .flatMap((promotion) =>
          promotion.propertyIds.map((propertyId) => ({ promotion, propertyId }))
        )
        .map(({ promotion, propertyId }) => {
          const property = db.properties.find((p) => p.id === propertyId)
          const originalPrice = property?.adr ?? 0
          return {
            rank: 0,
            propertyId,
            rating: property
              ? property.stars - 0.3 + (property.occupancy % 5) / 10
              : 0,
            discount: promotion.discount,
            discountedPrice: Math.round(
              originalPrice * (1 - promotion.discount / 100)
            ),
            originalPrice,
          }
        })
        .sort((a, b) => b.discount - a.discount)
        .map((row, i) => ({ ...row, rank: i + 1 }))
    ),

  setStatus: (id: string, status: Promotion["status"]) =>
    request(() => {
      const promotion = db.promotions.find((p) => p.id === id)
      if (!promotion) throw new NotFoundError(`Promotion ${id}`)
      promotion.status = status
      return promotion
    }),
}

/* ----------------------------------------------------------- billing */

export const billingApi = {
  subscriptions: () => request(() => [...db.billingInvoices]),

  markPaid: (id: string) =>
    request(() => {
      const invoice = db.billingInvoices.find((i) => i.id === id)
      if (!invoice) throw new NotFoundError(`Invoice ${id}`)
      if (invoice.status === "Paid") {
        throw new ApiError("Invoice is already paid.", 409, "already_paid")
      }
      invoice.status = "Paid"
      recordAudit({
        action: "Invoice marked paid",
        targetName: invoice.id,
        targetKind: "Invoice",
        details: `${invoice.description} — $${invoice.amount.toLocaleString("en-US")}`,
        category: "Billing",
      })
      return invoice
    }),
}

/* ------------------------------------------------------------- audit */

export const auditApi = {
  list: (params: ListParams = {}) =>
    request(() =>
      applyListParams(auditRows(), params, {
        searchFields: (e) => [
          e.action,
          e.actorName,
          e.targetName,
          e.details,
          e.category,
        ],
      })
    ),
}

/* ---------------------------------------------------------- settings */

export const settingsApi = {
  get: () => request(() => db.settings),

  update: (patch: Partial<PlatformSettings>) =>
    request(() => {
      db.settings = {
        general: { ...db.settings.general, ...patch.general },
        plans: { ...db.settings.plans, ...patch.plans },
      }
      recordAudit({
        action: "Platform settings updated",
        targetName: db.settings.general.platformName,
        targetKind: "Settings",
        details: "General and plan configuration saved",
        category: "System",
      })
      return db.settings
    }),

  integrations: () => request(() => [...db.integrations]),

  toggleIntegration: (id: string) =>
    request(() => {
      const integration = db.integrations.find((i) => i.id === id)
      if (!integration) throw new NotFoundError(`Integration ${id}`)
      integration.connected = !integration.connected
      return integration
    }),
}

/* ----------------------------------------------------- notifications */

export const notificationsApi = {
  list: () => request(() => [...db.notifications], { delay: 120 }),

  markAllRead: () =>
    request(() => {
      db.notifications.forEach((n) => {
        n.read = true
      })
      return [...db.notifications]
    }),
}

/* ------------------------------------------------------------ helpers */

function propertyName(id: string) {
  return db.properties.find((p) => p.id === id)?.name ?? "Unknown property"
}

function clientNameFor(propertyId: string) {
  const property = db.properties.find((p) => p.id === propertyId)
  return property ? (clientById(property.clientId)?.name ?? "—") : "—"
}

/** Mutations append here so the audit log reflects what actually happened. */
const sessionAudit: AuditEvent[] = []

function recordAudit(input: {
  action: string
  targetName: string
  targetKind: string
  details: string
  category: AuditCategory
}) {
  sessionAudit.unshift({
    id: `AUD-S${sessionAudit.length + 1}`,
    actorName: "Ahmed Khan",
    actorRole: "Super Admin",
    at: new Date().toISOString().slice(0, 16).replace("T", " "),
    ...input,
  })
}

function auditRows() {
  return [...sessionAudit, ...adminAuditEvents]
}

export const adminApi = {
  counts: countsApi,
  overview: overviewApi,
  clients: clientsApi,
  guests: guestsApi,
  properties: propertiesApi,
  managers: managersApi,
  reservations: reservationsApi,
  cancellations: cancellationsApi,
  inbox: inboxApi,
  reviews: reviewsApi,
  finance: financeApi,
  content: contentApi,
  promotions: promotionsApi,
  billing: billingApi,
  audit: auditApi,
  settings: settingsApi,
  notifications: notificationsApi,
}
