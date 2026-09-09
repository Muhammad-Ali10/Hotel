import { randomBytes } from "node:crypto"

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type {
  InviteCreateInput,
  MemberUpdateInput,
  OrgAdminUpdateInput,
  OrgCreateInput,
  OrgUpdateInput,
  PlatformSettingsInput,
  TeamInviteView,
  TeamMemberView,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { AuditService } from "../admin/audit.service"
import { hashToken } from "../auth/session.service"
import { NotificationsService } from "../notifications/notifications.service"
import {
  PartnerRepository,
  type InviteRow,
  type MemberRow,
  type OrgRow,
} from "./partner.repository"

/** An invitation may sit in a mailbox over a weekend, and then some. */
const INVITE_TTL_DAYS = 7

@Injectable()
export class PartnerService {
  constructor(
    private readonly repo: PartnerRepository,
    private readonly notifications: NotificationsService,
    // Changing the default commission changes what every future partner pays.
    private readonly audit: AuditService
  ) {}

  /* ------------------------------------------------------------ the org */

  async orgFor(user: AuthenticatedUser) {
    const org = await this.repo.findOrg(this.orgOf(user))
    if (!org) throw new NotFoundException("Organisation not found")
    return toOrgDto(org)
  }

  /**
   * A partner changing their own organisation's details (rule #59).
   *
   * The contract already refuses `commissionRateBps`, `planTier` and `status`,
   * so nothing is stripped here — a body carrying one never gets this far.
   * Those are the platform's side of the agreement; a partner who could set
   * their own commission would set it to zero.
   */
  async updateOrg(input: { user: AuthenticatedUser; patch: OrgUpdateInput }) {
    this.assertOrgAdmin(input.user)
    const row = await this.repo.updateOrg(this.orgOf(input.user), input.patch)
    if (!row) throw new NotFoundException("Organisation not found")
    return toOrgDto(row)
  }

  /* --------------------------------------------------------- the platform */

  /**
   * Onboarding a partner by hand (rule #59).
   *
   * Until the join wizard lands this is the only way an organisation comes
   * into existence — and it is not a stopgap: every marketplace signs its
   * first properties one at a time, with a person on each end.
   */
  /* ------------------------------------------- platform settings (#106) */

  settings() {
    return this.repo.settings().then(toSettingsDto)
  }

  async saveSettings(input: {
    patch: PlatformSettingsInput
    user: AuthenticatedUser
    ip?: string | null
  }) {
    const row = await this.repo.saveSettings(input.patch)

    /*
     * Audited, because one of these two changes what every future partner is
     * charged. "Who set the commission to 8% and when" has to have an answer
     * (rule #77).
     */
    await this.audit.record({
      actor: input.user,
      action: "platform.settings",
      subjectType: "partner_org",
      subjectId: null,
      reason: "Platform settings updated",
      metadata: { ...input.patch },
      ip: input.ip,
    })

    return toSettingsDto(row)
  }

  async createOrg(body: OrgCreateInput) {
    /*
     * A new organisation starts on the platform's current default rate.
     *
     * Read at creation and COPIED onto the row, never referenced. Existing
     * agreements are what their invoices were calculated from; a platform that
     * could reprice history by editing one field is one nobody can reconcile
     * against.
     */
    const settings = await this.repo.settings()
    const org = await this.repo.createOrg({
      ...body,
      // After the spread: the create contract does not accept a commission
      // rate (rule #59), so this is the only place it can come from.
      commissionRateBps: settings.defaultCommissionRateBps,
    })
    return toOrgDto(org, { includePlatform: true })
  }

  async listOrgs(query: { status?: string; limit: number }) {
    const rows = await this.repo.listOrgs(query)
    return rows.map((row) => toOrgDto(row, { includePlatform: true }))
  }

  /**
   * One client, whole (admin `clients/[id]`).
   *
   * The organisation, its properties and the people who can act for it, in one
   * response. Three round trips from the browser to draw one page is three
   * chances for it to render half-built.
   *
   * `includePlatform` is on: commission, plan and status are the platform's
   * side of the agreement, and this is the platform asking.
   */
  async adminOrgDetail(orgId: string) {
    const org = await this.repo.findOrg(orgId)
    if (!org) throw new NotFoundException("Organisation not found")

    const [properties, members] = await Promise.all([
      this.repo.propertiesFor(orgId),
      this.repo.listMembers(orgId),
    ])

    return {
      client: toOrgDto(org, { includePlatform: true }),
      properties,
      managers: members.map(toMemberDto),
    }
  }

  async adminUpdateOrg(input: { orgId: string; patch: OrgAdminUpdateInput }) {
    const row = await this.repo.updateOrg(input.orgId, input.patch)
    if (!row) throw new NotFoundException("Organisation not found")
    return toOrgDto(row, { includePlatform: true })
  }

  /* ---------------------------------------------------------------- team */

  async team(user: AuthenticatedUser) {
    const orgId = this.orgOf(user)
    const [members, invites] = await Promise.all([
      this.repo.listMembers(orgId),
      this.repo.listPendingInvites(orgId, new Date().toISOString()),
    ])

    return {
      members: members.map(toMemberDto),
      invites: invites.map(toInviteDto),
    }
  }

  /**
   * Inviting somebody (rule #60).
   *
   * One code path whether or not the address already has an account. That is
   * deliberate: branching would tell an org admin which of their colleagues is
   * already registered, and the whole point of the enumeration-safe signup was
   * to stop that question being answerable from outside.
   *
   * A second invitation to the same address retires the first, so a link
   * forwarded or left in a mailbox stops working the moment a new one is sent.
   */
  async invite(input: { user: AuthenticatedUser; body: InviteCreateInput; now?: Date }) {
    this.assertOrgAdmin(input.user)
    const orgId = this.orgOf(input.user)
    const now = input.now ?? new Date()

    const org = await this.repo.findOrg(orgId)
    if (!org) throw new NotFoundException("Organisation not found")

    await this.repo.revokeInvitesFor({ orgId, email: input.body.email })

    const token = randomBytes(32).toString("base64url")
    const invite = await this.repo.createInvite({
      orgId,
      email: input.body.email,
      role: input.body.role,
      propertyIds: input.body.propertyIds,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
      invitedByUserId: input.user.id,
    })

    await this.notifications.notify({
      template: "partner_invite",
      // Time-stamped: a re-invitation is a new message, and must not be
      // silenced by the first one's dedupe key.
      subjectId: `${invite.id}`,
      // No account may exist behind this address yet.
      userId: null,
      toEmail: input.body.email,
      payload: {
        token,
        orgName: org.name,
        role: input.body.role,
        invitedBy: `${input.user.firstName} ${input.user.lastName}`.trim(),
      },
    })

    return toInviteDto(invite)
  }

  /**
   * Accepting an invitation.
   *
   * The caller must be signed in AS the invited address. Without that check a
   * forwarded link would let anybody join somebody else's organisation — and
   * a team member is somebody who can change rates, read every guest's booking
   * and, at admin, move the payout account.
   */
  async acceptInvite(input: { token: string; user: AuthenticatedUser; now?: Date }) {
    const now = (input.now ?? new Date()).toISOString()

    // Checked BEFORE the token is spent, so a mismatch does not burn it.
    const invite = await this.repo.findInviteByToken(hashToken(input.token), now)
    if (!invite) throw new BadRequestException("That invitation is no longer valid")

    if (invite.email !== input.user.email) {
      throw new ForbiddenException("That invitation was sent to a different email address")
    }

    const claimed = await this.repo.consumeInvite({ tokenHash: hashToken(input.token), now })
    // Lost a race with another acceptance of the same link.
    if (!claimed) throw new BadRequestException("That invitation is no longer valid")

    await this.repo.upsertMembership({
      orgId: claimed.orgId,
      userId: input.user.id,
      role: claimed.role,
      propertyIds: claimed.propertyIds,
    })
    await this.repo.markUserAsPartner(input.user.id)

    const org = await this.repo.findOrg(claimed.orgId)
    return { orgId: claimed.orgId, orgName: org?.name ?? "", role: claimed.role }
  }

  async revokeInvite(input: { inviteId: string; user: AuthenticatedUser }) {
    this.assertOrgAdmin(input.user)
    const row = await this.repo.revokeInvite({
      inviteId: input.inviteId,
      orgId: this.orgOf(input.user),
    })
    // 404, never 403 — a 403 would confirm the invitation id is real (API1).
    if (!row) throw new NotFoundException("Invitation not found")
    return { revoked: true as const }
  }

  /* ------------------------------------------------------------- members */

  async updateMember(input: {
    memberId: string
    body: MemberUpdateInput
    user: AuthenticatedUser
  }) {
    this.assertOrgAdmin(input.user)
    const orgId = this.orgOf(input.user)

    const member = await this.repo.findMember({ memberId: input.memberId, orgId })
    if (!member) throw new NotFoundException("Team member not found")

    // Losing admin means either being demoted or being switched off.
    const losesAdmin =
      member.role === "admin" &&
      (input.body.role !== undefined && input.body.role !== "admin"
        ? true
        : input.body.status === "suspended")

    if (losesAdmin) await this.assertNotLastAdmin({ orgId, memberId: member.id })

    const updated = await this.repo.updateMember(input.memberId, input.body)
    if (!updated) throw new NotFoundException("Team member not found")

    const [withUser] = (await this.repo.listMembers(orgId)).filter(
      (m) => m.member.id === updated.id
    )
    return toMemberDto(withUser!)
  }

  async removeMember(input: { memberId: string; user: AuthenticatedUser }) {
    this.assertOrgAdmin(input.user)
    const orgId = this.orgOf(input.user)

    const member = await this.repo.findMember({ memberId: input.memberId, orgId })
    if (!member) throw new NotFoundException("Team member not found")

    if (member.role === "admin" && member.status === "active") {
      await this.assertNotLastAdmin({ orgId, memberId: member.id })
    }

    await this.repo.deleteMember({ memberId: input.memberId, orgId })
    return { removed: true as const }
  }

  /* ----------------------------------------------------------------- authz */

  /**
   * The org must keep at least one active admin (rule #61).
   *
   * Without this the last admin can lock everybody out with one click: nobody
   * left can change the payout account, invite anyone, or edit a rate plan's
   * terms — and the only way back is a platform administrator.
   */
  private async assertNotLastAdmin(input: { orgId: string; memberId: string }) {
    const others = await this.repo.countOtherActiveAdmins({
      orgId: input.orgId,
      exceptMemberId: input.memberId,
    })
    if (others === 0) {
      throw new ConflictException(
        "An organisation needs at least one admin. Make somebody else an admin first."
      )
    }
  }

  private orgOf(user: AuthenticatedUser): string {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    return user.partner.orgId
  }

  private assertOrgAdmin(user: AuthenticatedUser) {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    if (user.partner.role !== "admin") {
      throw new ForbiddenException("Only an organisation admin can manage the team")
    }
  }
}

/* ------------------------------------------------------------------- DTOs -- */

/**
 * Explicit fields (API3).
 *
 * `commissionRateBps`, `planTier` and `status` are the PLATFORM's side of the
 * agreement. A partner sees their own commission on every payout statement,
 * which is the right place for it; putting it on a settings screen invites the
 * question of why it is not editable there.
 */
function toOrgDto(row: OrgRow, options: { includePlatform?: boolean } = {}) {
  return {
    id: row.id,
    name: row.name,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    country: row.country,
    createdAt: row.createdAt,
    ...(options.includePlatform
      ? {
          status: row.status,
          planTier: row.planTier,
          commissionRateBps: row.commissionRateBps,
        }
      : {}),
  }
}

function toMemberDto(row: {
  member: MemberRow
  firstName: string
  lastName: string
  email: string
  phone?: string
}): TeamMemberView {
  return {
    id: row.member.id,
    userId: row.member.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone ?? "",
    jobTitle: row.member.jobTitle,
    role: row.member.role as TeamMemberView["role"],
    status: row.member.status,
    propertyIds: row.member.propertyIds,
    lastLoginAt: row.member.lastLoginAt,
    createdAt: row.member.createdAt,
  }
}

/** No token, and no hash of one — a pending invitation is not a credential. */
function toInviteDto(row: InviteRow): TeamInviteView {
  return {
    id: row.id,
    email: row.email,
    role: row.role as TeamInviteView["role"],
    propertyIds: row.propertyIds,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  }
}

function toSettingsDto(row: {
  supportEmail: string
  defaultCommissionRateBps: number
  updatedAt: string
}) {
  return {
    supportEmail: row.supportEmail,
    defaultCommissionRateBps: row.defaultCommissionRateBps,
    /**
     * Read-only, and stated rather than offered.
     *
     * Every price in the system is USD cents and four places hard-code it.
     * A currency picker that changed nothing would be the worst kind of
     * setting: one somebody sets, believes, and discovers much later.
     */
    currency: "USD" as const,
    updatedAt: row.updatedAt,
  }
}

