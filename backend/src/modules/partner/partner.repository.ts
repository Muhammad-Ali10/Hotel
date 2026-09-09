import { Inject, Injectable } from "@nestjs/common"
import { and, asc, desc, eq, gt, isNull, ne, sql } from "drizzle-orm"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  partnerInvites,
  partnerMembers,
  partnerOrgs,
  platformSettings,
  properties,
  users,
} from "../../db/schema"

export type OrgRow = typeof partnerOrgs.$inferSelect
export type MemberRow = typeof partnerMembers.$inferSelect
export type InviteRow = typeof partnerInvites.$inferSelect

@Injectable()
export class PartnerRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /* ------------------------------------------------------------------ org */

  /* ------------------------------------------------- platform settings -- */

  /**
   * The single settings row, created on first read.
   *
   * `ON CONFLICT DO NOTHING` against the `id = 1` primary key: two admins
   * opening the screen at once both try to create it, and the second must join
   * the first rather than fail.
   */
  async settings() {
    const [existing] = await this.db.select().from(platformSettings).limit(1)
    if (existing) return existing

    const [created] = await this.db
      .insert(platformSettings)
      .values({ id: 1 })
      .onConflictDoNothing()
      .returning()
    if (created) return created

    const [row] = await this.db.select().from(platformSettings).limit(1)
    return row!
  }

  async saveSettings(patch: Partial<typeof platformSettings.$inferInsert>) {
    await this.settings()
    const [row] = await this.db
      .update(platformSettings)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(platformSettings.id, 1))
      .returning()
    return row!
  }

  async createOrg(row: typeof partnerOrgs.$inferInsert) {
    const [created] = await this.db.insert(partnerOrgs).values(row).returning()
    return created!
  }

  async findOrg(orgId: string) {
    const [row] = await this.db
      .select()
      .from(partnerOrgs)
      .where(eq(partnerOrgs.id, orgId))
      .limit(1)
    return row ?? null
  }

  async updateOrg(orgId: string, patch: Partial<typeof partnerOrgs.$inferInsert>) {
    const [row] = await this.db
      .update(partnerOrgs)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(partnerOrgs.id, orgId))
      .returning()
    return row ?? null
  }

  async listOrgs(input: { status?: string; limit: number }) {
    const where = input.status ? [eq(partnerOrgs.status, input.status)] : []
    return this.db
      .select()
      .from(partnerOrgs)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(partnerOrgs.createdAt))
      .limit(input.limit)
  }

  /* ----------------------------------------------------------------- team */

  /** The team, with enough of each person to recognise them. */
  /**
   * An organisation's properties, for the platform's client page.
   *
   * Kept here rather than reaching into the catalogue repository: this is a
   * summary row for one screen, not the catalogue's idea of a property, and
   * the two would grow apart.
   */
  async propertiesFor(orgId: string) {
    return this.db
      .select({
        id: properties.id,
        slug: properties.slug,
        name: properties.name,
        city: properties.city,
        country: properties.country,
        status: properties.status,
        stars: properties.stars,
        fromPrice: properties.basePrice,
        createdAt: properties.createdAt,
      })
      .from(properties)
      .where(eq(properties.partnerOrgId, orgId))
      .orderBy(asc(properties.name))
  }

  async listMembers(orgId: string) {
    return this.db
      .select({
        member: partnerMembers,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
      })
      .from(partnerMembers)
      .innerJoin(users, eq(users.id, partnerMembers.userId))
      .where(eq(partnerMembers.orgId, orgId))
      .orderBy(desc(partnerMembers.createdAt))
  }

  /** A membership, scoped to its org — somebody else's is not found (API1). */
  async findMember(input: { memberId: string; orgId: string }) {
    const [row] = await this.db
      .select()
      .from(partnerMembers)
      .where(and(eq(partnerMembers.id, input.memberId), eq(partnerMembers.orgId, input.orgId)))
      .limit(1)
    return row ?? null
  }

  /**
   * How many ACTIVE admins the org has, not counting one (rule #61).
   *
   * Counted at the moment of the change rather than tracked as a flag: a
   * counter on the org is one more thing to keep in step, and the question is
   * only asked when somebody is being demoted, suspended or removed.
   */
  async countOtherActiveAdmins(input: { orgId: string; exceptMemberId: string }) {
    const [row] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(partnerMembers)
      .where(
        and(
          eq(partnerMembers.orgId, input.orgId),
          eq(partnerMembers.role, "admin"),
          eq(partnerMembers.status, "active"),
          ne(partnerMembers.id, input.exceptMemberId)
        )
      )
    return Number(row?.count ?? 0)
  }

  async updateMember(memberId: string, patch: Partial<typeof partnerMembers.$inferInsert>) {
    const [row] = await this.db
      .update(partnerMembers)
      .set({ ...patch, updatedAt: new Date().toISOString() })
      .where(eq(partnerMembers.id, memberId))
      .returning()
    return row ?? null
  }

  async deleteMember(input: { memberId: string; orgId: string }) {
    const [row] = await this.db
      .delete(partnerMembers)
      .where(and(eq(partnerMembers.id, input.memberId), eq(partnerMembers.orgId, input.orgId)))
      .returning()
    return row ?? null
  }

  /* -------------------------------------------------------------- invites */

  async createInvite(row: typeof partnerInvites.$inferInsert) {
    const [created] = await this.db.insert(partnerInvites).values(row).returning()
    return created!
  }

  /** Invitations still waiting — not accepted, not revoked, not expired. */
  async listPendingInvites(orgId: string, now: string) {
    return this.db
      .select()
      .from(partnerInvites)
      .where(
        and(
          eq(partnerInvites.orgId, orgId),
          isNull(partnerInvites.acceptedAt),
          isNull(partnerInvites.revokedAt),
          gt(partnerInvites.expiresAt, now)
        )
      )
      .orderBy(desc(partnerInvites.createdAt))
  }

  /**
   * Spends an invitation, once.
   *
   * Guarded in the UPDATE — unaccepted, unrevoked and unexpired all sit in the
   * WHERE. Reading the row and then marking it used leaves the window two
   * requests need to accept the same invitation, and the second one would be
   * joining somebody to an organisation on a link already spent.
   */
  async consumeInvite(input: { tokenHash: string; now: string }) {
    const [row] = await this.db
      .update(partnerInvites)
      .set({ acceptedAt: input.now, updatedAt: input.now })
      .where(
        and(
          eq(partnerInvites.tokenHash, input.tokenHash),
          isNull(partnerInvites.acceptedAt),
          isNull(partnerInvites.revokedAt),
          gt(partnerInvites.expiresAt, input.now)
        )
      )
      .returning()
    return row ?? null
  }

  /**
   * Reads an invitation without spending it.
   *
   * The address is checked before the token is consumed, so somebody clicking
   * a link meant for a colleague gets told so rather than silently burning it
   * — and the colleague's invitation still works.
   */
  async findInviteByToken(tokenHash: string, now: string) {
    const [row] = await this.db
      .select()
      .from(partnerInvites)
      .where(
        and(
          eq(partnerInvites.tokenHash, tokenHash),
          isNull(partnerInvites.acceptedAt),
          isNull(partnerInvites.revokedAt),
          gt(partnerInvites.expiresAt, now)
        )
      )
      .limit(1)
    return row ?? null
  }

  /** Retires outstanding invitations to one address — a re-invite replaces. */
  async revokeInvitesFor(input: { orgId: string; email: string }) {
    await this.db
      .update(partnerInvites)
      .set({ revokedAt: new Date().toISOString() })
      .where(
        and(
          eq(partnerInvites.orgId, input.orgId),
          eq(partnerInvites.email, input.email),
          isNull(partnerInvites.acceptedAt),
          isNull(partnerInvites.revokedAt)
        )
      )
  }

  async revokeInvite(input: { inviteId: string; orgId: string }) {
    const [row] = await this.db
      .update(partnerInvites)
      .set({ revokedAt: new Date().toISOString() })
      .where(
        and(
          eq(partnerInvites.id, input.inviteId),
          eq(partnerInvites.orgId, input.orgId),
          isNull(partnerInvites.acceptedAt)
        )
      )
      .returning()
    return row ?? null
  }

  /**
   * Turns an accepted invitation into a membership.
   *
   * `onConflictDoUpdate` because the person may already be in the org —
   * invited twice, or re-invited with a different role. Failing on the unique
   * key would tell an org admin that a perfectly reasonable request was an
   * error.
   */
  async upsertMembership(row: {
    orgId: string
    userId: string
    role: string
    propertyIds: string[]
  }) {
    const [created] = await this.db
      .insert(partnerMembers)
      .values({ ...row, status: "active" })
      .onConflictDoUpdate({
        target: [partnerMembers.orgId, partnerMembers.userId],
        set: {
          role: row.role,
          propertyIds: row.propertyIds,
          status: "active",
          updatedAt: new Date().toISOString(),
        },
      })
      .returning()
    return created!
  }

  /** The account behind an address, if there is one. */
  async findUserByEmail(email: string) {
    const [row] = await this.db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    return row ?? null
  }

  /**
   * Promotes an account to the partner surface when it joins an org.
   *
   * Guarded on `customer`, so joining an org never demotes a platform admin
   * who happens to also help run a hotel.
   */
  async markUserAsPartner(userId: string) {
    await this.db
      .update(users)
      .set({ role: "partner", updatedAt: new Date().toISOString() })
      .where(and(eq(users.id, userId), eq(users.role, "customer")))
  }
}
