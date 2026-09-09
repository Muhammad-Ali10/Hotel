import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common"
import type {
  AnalyticsRangeInput,
  PlatformClientRow,
  PlatformOverview,
  PlatformRangeInput,
  AnalyticsTrendInput,
  BookersView,
  BookerSegmentView,
  BookWindowView,
  CancellationsView,
  ComparablesView,
  GeniusView,
  MaybeCents,
  PaceView,
  PerformanceRowView,
  SalesView,
} from "@stayora/shared"
import {
  adr,
  BOOK_WINDOW_BUCKETS,
  bookWindowBucket,
  canSeeRevenue,
  marketAggregate,
  occupancy,
  revpar,
  versusMarket,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { AnalyticsRepository } from "./analytics.repository"

/**
 * A caller's resolved view of the world: which properties, and whether money.
 *
 * Built once per request and threaded through, so a screen cannot accidentally
 * answer for a property outside the scope or reveal a figure the role does not
 * carry (rule #66, API1/API5).
 */
type Scope = {
  propertyIds: string[]
  revenue: boolean
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly repo: AnalyticsRepository) {}

  /* --------------------------------------------------------------- sales -- */

  async sales(user: AuthenticatedUser, query: AnalyticsTrendInput): Promise<SalesView> {
    const scope = await this.scopeFor(user, query.propertyId)
    const previousRange = precedingWindow(query.from, query.to)

    const [points, totals, fees, previous] = await Promise.all([
      this.repo.salesByPeriod({ ...scope, ...query }),
      this.repo.salesTotals({ ...scope, from: query.from, to: query.to }),
      this.repo.feesRetained({ ...scope, from: query.from, to: query.to }),
      this.repo.salesTotals({ ...scope, ...previousRange }),
    ])

    return {
      granularity: query.granularity,
      points: points.map((point) => ({
        period: point.period,
        bookings: point.bookings,
        revenue: money(point.revenue, scope),
        commission: money(point.commission, scope),
      })),
      totals: {
        bookings: totals.bookings,
        revenue: money(totals.revenue, scope),
        commission: money(totals.commission, scope),
        fees: money(fees, scope),
        cancelled: totals.cancelled,
      },
      previous: {
        bookings: previous.bookings,
        revenue: money(previous.revenue, scope),
      },
    }
  }

  /* --------------------------------------------------------- performance -- */

  /**
   * Revenue, ADR, occupancy and RevPAR per property, on the stay-date basis.
   *
   * A property with no bookings in the range still gets a row. Dropping it
   * would make an empty month look like a shorter portfolio rather than a bad
   * one, which is the opposite of what the screen is for.
   */
  async performance(
    user: AuthenticatedUser,
    query: AnalyticsRangeInput
  ): Promise<PerformanceRowView[]> {
    const scope = await this.scopeFor(user, query.propertyId)
    const range = { from: query.from, to: query.to }

    const [nights, available, scores, names] = await Promise.all([
      this.repo.stayNightsByProperty({ ...scope, ...range }),
      this.repo.availableNights({ ...scope, ...range }),
      this.repo.reviewScores(scope.propertyIds),
      this.repo.propertyNames(scope.propertyIds),
    ])

    const nightsBy = byId(nights)
    const availableBy = byId(available)
    const scoresBy = byId(scores)

    return names
      .map((property): PerformanceRowView => {
        const sold = nightsBy.get(property.id)
        const capacity = availableBy.get(property.id)?.available ?? 0
        const review = scoresBy.get(property.id)
        const roomNights = sold?.roomNights ?? 0
        const roomRevenue = sold?.roomRevenue ?? 0

        return {
          propertyId: property.id,
          property: property.name,
          roomNights,
          roomNightsAvailable: capacity,
          bookings: sold?.bookings ?? 0,
          revenue: money(roomRevenue, scope),
          adr: money(adr(roomRevenue, roomNights), scope),
          revpar: money(revpar(roomRevenue, capacity), scope),
          occupancy: occupancy(roomNights, capacity),
          score: review?.score ?? null,
          reviews: review?.reviews ?? 0,
        }
      })
      .sort((a, b) => b.roomNights - a.roomNights)
  }

  /* ---------------------------------------------------------------- pace -- */

  /**
   * Nights already stayed, and nights on the books ahead.
   *
   * The split is `today`, taken from the clock once so both halves agree. A
   * period straddling today lands in `completed` — its nights that have not
   * happened yet are still counted there, which is the convention the industry
   * uses and the only one that makes the two halves add up to the range.
   */
  async pace(user: AuthenticatedUser, query: AnalyticsTrendInput, now = new Date()): Promise<PaceView> {
    const scope = await this.scopeFor(user, query.propertyId)
    const today = now.toISOString().slice(0, 10)

    const completedTo = min(query.to, today)
    const futureFrom = max(query.from, today)

    const [stayed, capacity, booked, lastYear] = await Promise.all([
      completedTo >= query.from
        ? this.repo.stayNightsByPeriod({ ...scope, from: query.from, to: completedTo, granularity: query.granularity })
        : Promise.resolve([]),
      completedTo >= query.from
        ? this.repo.availableNightsByPeriod({ ...scope, from: query.from, to: completedTo, granularity: query.granularity })
        : Promise.resolve([]),
      futureFrom <= query.to
        ? this.repo.onTheBooksAsOf({ ...scope, from: futureFrom, to: query.to, asOf: now.toISOString(), granularity: query.granularity })
        : Promise.resolve([]),
      // The same window a year back, cut off at the same distance out.
      futureFrom <= query.to
        ? this.repo.onTheBooksAsOf({
            ...scope,
            from: shiftYear(futureFrom, -1),
            to: shiftYear(query.to, -1),
            asOf: shiftYear(now.toISOString().slice(0, 10), -1) + "T23:59:59Z",
            granularity: query.granularity,
          })
        : Promise.resolve([]),
    ])

    const capacityBy = new Map(capacity.map((c) => [c.period, c.available]))
    // Keyed by the period shifted FORWARD, so last year lines up with this one.
    const lastYearBy = new Map(lastYear.map((r) => [shiftYear(r.period, 1), r.roomNights]))

    return {
      completed: stayed.map((row) => {
        const available = capacityBy.get(row.period) ?? 0
        return {
          period: row.period,
          bookings: row.bookings,
          roomNights: row.roomNights,
          revenue: money(row.roomRevenue, scope),
          adr: money(adr(row.roomRevenue, row.roomNights), scope),
          occupancy: occupancy(row.roomNights, available),
        }
      }),
      future: booked.map((row) => ({
        period: row.period,
        bookedNow: row.roomNights,
        lastYear: lastYearBy.get(row.period) ?? 0,
        revenue: money(row.roomRevenue, scope),
      })),
    }
  }

  /* ------------------------------------------------------- cancellations -- */

  async cancellations(
    user: AuthenticatedUser,
    query: AnalyticsRangeInput
  ): Promise<CancellationsView> {
    const scope = await this.scopeFor(user, query.propertyId)
    const range = { from: query.from, to: query.to }

    const [summary, reasons, actors, fees] = await Promise.all([
      this.repo.cancellations({ ...scope, ...range }),
      this.repo.cancellationReasons({ ...scope, ...range }),
      this.repo.cancellationActors({ ...scope, ...range }),
      this.repo.feesRetained({ ...scope, ...range }),
    ])

    const cancelledTotal = summary.total + summary.noShows

    return {
      total: summary.total,
      rate: summary.madeInRange > 0 ? cancelledTotal / summary.madeInRange : 0,
      noShows: summary.noShows,
      avgDaysBefore: summary.avgDaysBefore,
      feesCharged: money(fees, scope),
      refunded: money(summary.refunded, scope),
      byReason: reasons.map((row) => ({
        reason: row.reason,
        count: row.count,
        share: summary.total > 0 ? row.count / summary.total : 0,
        avgDaysBefore: row.avgDaysBefore,
      })),
      byActor: actors,
    }
  }

  /* ---------------------------------------------------------- book window -- */

  /**
   * How far ahead people book, bucketed.
   *
   * The bucketing happens here rather than in SQL because
   * `bookWindowBucket()` is the tested definition of those boundaries — a
   * `CASE` expression in the query would be a second copy of the same rule
   * that nothing would notice drifting out of step.
   */
  async bookWindow(user: AuthenticatedUser, query: AnalyticsRangeInput): Promise<BookWindowView> {
    const scope = await this.scopeFor(user, query.propertyId)
    const rows = await this.repo.leadTimes({ ...scope, from: query.from, to: query.to })

    const tally = new Map(
      BOOK_WINDOW_BUCKETS.map((bucket) => [
        bucket.key,
        { bookings: 0, cancelled: 0, roomRevenue: 0, roomNights: 0 },
      ])
    )

    let total = 0
    for (const row of rows) {
      const bucket = tally.get(bookWindowBucket(row.leadDays))!
      bucket.bookings += row.bookings
      bucket.cancelled += row.cancelled
      bucket.roomRevenue += row.roomRevenue
      bucket.roomNights += row.roomNights
      total += row.bookings
    }

    return {
      buckets: BOOK_WINDOW_BUCKETS.map((bucket) => {
        const counted = tally.get(bucket.key)!
        return {
          key: bucket.key,
          label: bucket.label,
          bookings: counted.bookings,
          share: total > 0 ? counted.bookings / total : 0,
          avgRate: money(adr(counted.roomRevenue, counted.roomNights), scope),
          cancelRate: counted.bookings > 0 ? counted.cancelled / counted.bookings : 0,
        }
      }),
      medianLeadDays: medianLeadDays(rows),
    }
  }

  /* --------------------------------------------------------------- bookers -- */

  async bookers(user: AuthenticatedUser, query: AnalyticsRangeInput): Promise<BookersView> {
    const scope = await this.scopeFor(user, query.propertyId)
    const range = { from: query.from, to: query.to }

    const [country, party, source, repeat] = await Promise.all([
      this.repo.bookerSegments({ ...scope, ...range, dimension: "country" }),
      this.repo.bookerSegments({ ...scope, ...range, dimension: "party" }),
      this.repo.bookerSegments({ ...scope, ...range, dimension: "source" }),
      this.repo.repeatGuests({ ...scope, ...range }),
    ])

    const toView = (rows: typeof country): BookerSegmentView[] => {
      const total = rows.reduce((sum, row) => sum + row.bookings, 0)
      return rows.map((row) => ({
        segment: row.segment,
        bookings: row.bookings,
        share: total > 0 ? row.bookings / total : 0,
        avgSpend: money(row.bookings > 0 ? Math.round(row.totalSpend / row.bookings) : 0, scope),
        avgStay: row.bookings > 0 ? row.totalNights / row.bookings : 0,
        topSource: row.topSource,
      }))
    }

    return {
      byCountry: toView(country),
      byParty: toView(party),
      bySource: toView(source),
      repeatRate: repeat.guests > 0 ? repeat.repeat / repeat.guests : 0,
    }
  }

  /* ---------------------------------------------------------------- genius -- */

  async genius(user: AuthenticatedUser, query: AnalyticsRangeInput): Promise<GeniusView> {
    const scope = await this.scopeFor(user, query.propertyId)
    const { genius, other } = await this.repo.geniusSplit({
      ...scope,
      from: query.from,
      to: query.to,
    })

    const total = genius.bookings + other.bookings

    return {
      bookings: genius.bookings,
      totalBookings: total,
      share: total > 0 ? genius.bookings / total : 0,
      revenue: money(genius.revenue, scope),
      adr: money(adr(genius.roomRevenue, genius.roomNights), scope),
      nonGeniusAdr: money(adr(other.roomRevenue, other.roomNights), scope),
      discountGiven: money(genius.discount, scope),
      guests: genius.guests,
    }
  }

  /* ----------------------------------------------------------- comparables -- */

  /**
   * A property against its city, anonymously (rule #65).
   *
   * Requires a single `propertyId` — "how does my portfolio compare" has no
   * meaning when the properties sit in different cities, and quietly picking
   * one would be a number the partner could not interpret.
   *
   * The property itself is excluded from the market it is compared against.
   * Leaving it in pulls the average toward its own figure, which flatters an
   * outlier exactly when the comparison matters most.
   */
  async comparables(
    user: AuthenticatedUser,
    query: AnalyticsRangeInput
  ): Promise<ComparablesView> {
    if (!query.propertyId) {
      throw new NotFoundException("Comparables need a single property")
    }
    const scope = await this.scopeFor(user, query.propertyId)
    const [property] = await this.repo.propertyNames(scope.propertyIds)
    if (!property) throw new NotFoundException("Property not found")

    const rows = await this.repo.marketByCity({
      city: property.city,
      from: query.from,
      to: query.to,
    })

    const mineRow = rows.find((row) => row.propertyId === query.propertyId)
    const others = rows.filter((row) => row.propertyId !== query.propertyId)

    const mineAdr = adr(mineRow?.roomRevenue ?? 0, mineRow?.roomNights ?? 0)
    const mineOccupancy = occupancy(mineRow?.roomNights ?? 0, mineRow?.available ?? 0)

    // Only properties that actually traded contribute a rate.
    const traded = others.filter((row) => row.roomNights > 0)
    const marketAdr = marketAggregate(traded.map((row) => adr(row.roomRevenue, row.roomNights)))
    const marketOccupancy = marketAggregate(
      others.filter((row) => row.available > 0).map((row) => occupancy(row.roomNights, row.available))
    )
    const marketScore = marketAggregate(
      others.filter((row) => row.score !== null).map((row) => row.score!)
    )

    /*
     * All three market figures stand or fall together (rule #65).
     *
     * They are drawn from different subsets — a property can have inventory
     * loaded without having sold a night, and reviews without either — so
     * gating each on its own sample would let occupancy publish while the
     * rate stayed hidden. That is not the promise the contract makes, and a
     * response reading `suppressed: true` beside a real market number is one
     * a caller would reasonably render.
     *
     * The rate is what decides, because the rate is what is worth hiding.
     */
    const suppressed = marketAdr === null
    const marketRate = suppressed ? null : Math.round(marketAdr!.average)

    return {
      city: property.city,
      // The count, not the identities — and only once it is publishable. The
      // size of a market is itself a hint about who is in it.
      sample: suppressed ? 0 : traded.length,
      suppressed,
      mine: {
        adr: money(mineAdr, scope),
        occupancy: mineOccupancy,
        score: mineRow?.score ?? null,
      },
      market: suppressed
        ? { adr: null, occupancy: null, score: null }
        : {
            adr: money(marketRate!, scope),
            occupancy: marketOccupancy?.average ?? null,
            score: marketScore === null ? null : Number(marketScore.average.toFixed(2)),
          },
      versus: suppressed
        ? { adr: null, occupancy: null, score: null }
        : {
            adr: versusMarket(mineAdr, marketRate),
            occupancy: versusMarket(mineOccupancy, marketOccupancy?.average ?? null),
            score:
              mineRow?.score == null
                ? null
                : versusMarket(mineRow.score, marketScore?.average ?? null),
          },
    }
  }


  /* ------------------------------------------------------- the platform -- */

  /**
   * The marketplace, from the platform's side (rules #82–#84).
   *
   * The SAME engine the partner screens run on, with the scope taken off —
   * `scopeFor` resolves to one org's properties, this resolves to all of them.
   * A second implementation would be a second definition of every metric, and
   * the two would drift the first time either was touched.
   */
  async platformOverview(query: PlatformRangeInput): Promise<PlatformOverview> {
    const propertyIds = await this.repo.allPropertyIds(query.orgId)
    const scope = { propertyIds, revenue: true }
    const previousRange = precedingWindow(query.from, query.to)

    const [totals, fees, previous, shape] = await Promise.all([
      this.repo.salesTotals({ ...scope, from: query.from, to: query.to }),
      this.repo.feesRetained({ ...scope, from: query.from, to: query.to }),
      this.repo.salesTotals({ ...scope, ...previousRange }),
      this.repo.platformShape(),
    ])

    return {
      // The guests' money, passed through. Mostly the property's.
      gmv: totals.revenue,
      // The platform's own — commission, and nothing else (rule #82).
      revenue: totals.commission,
      takeRate: takeRate(totals.commission, totals.revenue),
      bookings: totals.bookings,
      cancelled: totals.cancelled,
      fees,
      shape,
      previous: {
        gmv: previous.revenue,
        revenue: previous.commission,
        bookings: previous.bookings,
      },
    }
  }

  /** The trend, unscoped. Same query the partner sales screen uses. */
  async platformSales(query: PlatformRangeInput) {
    const propertyIds = await this.repo.allPropertyIds(query.orgId)
    const points = await this.repo.salesByPeriod({
      propertyIds,
      from: query.from,
      to: query.to,
      granularity: query.granularity,
    })

    return {
      granularity: query.granularity,
      points: points.map((point) => ({
        period: point.period,
        bookings: point.bookings,
        // Named for what they are, so no chart can label GMV as revenue.
        gmv: point.revenue,
        revenue: point.commission,
      })),
    }
  }

  /**
   * Every client, ranked by what they brought the platform (rule #82).
   *
   * Ranked on COMMISSION rather than GMV: a client sending large volume at a
   * negotiated low rate is worth less to the platform than the raw figure
   * suggests, and ordering by GMV would put them at the top of a list whose
   * whole purpose is to say who matters.
   */
  async platformClients(query: PlatformRangeInput & { limit: number }): Promise<PlatformClientRow[]> {
    const rows = await this.repo.byOrg({
      from: query.from,
      to: query.to,
      limit: query.limit,
    })

    const platformCommission = rows.reduce((sum, row) => sum + row.commission, 0)

    return rows.map((row) => ({
      orgId: row.orgId,
      orgName: row.orgName,
      properties: row.properties,
      bookings: row.bookings,
      cancelled: row.cancelled,
      gmv: row.gmv,
      revenue: row.commission,
      share: platformCommission > 0 ? row.commission / platformCommission : 0,
      takeRate: takeRate(row.commission, row.gmv),
    }))
  }

  /* ----------------------------------------------------------------- scope -- */

  /**
   * Which properties this caller may ask about, and whether money is included.
   *
   * The org comes from the session. A requested `propertyId` is INTERSECTED
   * with what the caller already had rather than trusted — and a property
   * outside that set is a 404, never a 403, because a 403 would confirm the id
   * belongs to somebody (API1).
   */
  private async scopeFor(user: AuthenticatedUser, propertyId?: string): Promise<Scope> {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")

    const allowed = await this.repo.scopedPropertyIds(
      user.partner.orgId,
      user.partner.propertyIds
    )

    if (propertyId) {
      if (!allowed.includes(propertyId)) throw new NotFoundException("Property not found")
      return { propertyIds: [propertyId], revenue: canSeeRevenue(user.partner.role) }
    }

    return { propertyIds: allowed, revenue: canSeeRevenue(user.partner.role) }
  }
}

/* ----------------------------------------------------------------- local -- */

/**
 * Money, or `null` for a caller whose role does not carry it (rule #66).
 *
 * `null` rather than `0`: zero is a claim about the business — "you earned
 * nothing" — and a front-desk screen quietly reporting that would be worse than
 * one that says nothing at all.
 */
function money(value: number, scope: Scope): MaybeCents {
  return scope.revenue ? value : null
}

/**
 * Commission over gross, for the same window (rule #83).
 *
 * `null` when nothing traded — a take rate of zero reads as "we charged
 * nothing", which is a different and alarming statement from "nobody booked".
 */
function takeRate(commission: number, gmv: number): number | null {
  return gmv > 0 ? commission / gmv : null
}

function byId<T extends { propertyId: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.propertyId, row]))
}

/** The equal-length window immediately before `from`, for period-on-period. */
function precedingWindow(from: string, to: string): { from: string; to: string } {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
  const previousTo = addDays(from, -1)
  return { from: addDays(previousTo, -days), to: previousTo }
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * The same calendar date, a year away.
 *
 * 29 February has no counterpart in a common year; `setUTCFullYear` rolls it to
 * 1 March, which is the behaviour wanted here — the comparison is about being
 * roughly a year back, and refusing to answer one day in four years would be a
 * gap nobody could explain.
 */
function shiftYear(iso: string, years: number): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  date.setUTCFullYear(date.getUTCFullYear() + years)
  return date.toISOString().slice(0, 10)
}

function min(a: string, b: string): string {
  return a < b ? a : b
}

function max(a: string, b: string): string {
  return a > b ? a : b
}

/**
 * The middle lead time, weighted by how many bookings sit at each.
 *
 * A median rather than a mean because the distribution is bimodal — a handful
 * of bookings made a year out drag an average into a gap where almost nothing
 * actually falls.
 */
function medianLeadDays(rows: { leadDays: number; bookings: number }[]): number | null {
  const total = rows.reduce((sum, row) => sum + row.bookings, 0)
  if (total === 0) return null

  const sorted = [...rows].sort((a, b) => a.leadDays - b.leadDays)
  let seen = 0
  for (const row of sorted) {
    seen += row.bookings
    if (seen >= total / 2) return row.leadDays
  }
  return sorted[sorted.length - 1]!.leadDays
}
