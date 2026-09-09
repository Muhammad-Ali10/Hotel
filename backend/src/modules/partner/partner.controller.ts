import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query } from "@nestjs/common"
import {
  inviteAcceptSchema,
  inviteCreateSchema,
  memberUpdateSchema,
  orgAdminUpdateSchema,
  orgCreateSchema,
  platformSettingsSchema,
  orgUpdateSchema,
  type InviteAcceptInput,
  type InviteCreateInput,
  type MemberUpdateInput,
  type OrgAdminUpdateInput,
  type OrgCreateInput,
  type PlatformSettingsInput,
  type OrgUpdateInput,
} from "@stayora/shared"
import { z } from "zod"

import { AdminResource, CurrentUser, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import { AuthThrottle } from "../../common/throttling/throttling"
import type { AuthenticatedUser } from "../auth/auth.service"
import { PartnerService } from "./partner.service"

const orgListSchema = z
  .object({
    status: z.enum(["active", "trial", "past_due", "suspended"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict()

type OrgListInput = z.infer<typeof orgListSchema>

/**
 * A property company's own record and its people.
 *
 * The org always comes from the session, never a parameter — an `orgId` in the
 * path would be a way to read or edit a competitor's team (API1).
 */
@Controller("partner/org")
@Roles("partner")
export class PartnerOrgController {
  constructor(private readonly partner: PartnerService) {}

  @Get()
  org(@CurrentUser() user: AuthenticatedUser) {
    return this.partner.orgFor(user)
  }

  @Patch()
  update(
    @Body(new ZodValidationPipe(orgUpdateSchema)) body: OrgUpdateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.partner.updateOrg({ user, patch: body })
  }
}

@Controller("partner/team")
@Roles("partner")
export class PartnerTeamController {
  constructor(private readonly partner: PartnerService) {}

  /** Members and pending invitations — the whole team screen in one call. */
  @Get()
  team(@CurrentUser() user: AuthenticatedUser) {
    return this.partner.team(user)
  }

  /**
   * Inviting somebody (rule #60).
   *
   * Throttled like an auth route: it sends mail to an address the caller
   * chooses, which is a thing worth rate limiting whoever is asking.
   */
  @Post("invites")
  @AuthThrottle()
  invite(
    @Body(new ZodValidationPipe(inviteCreateSchema)) body: InviteCreateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.partner.invite({ user, body })
  }

  @Delete("invites/:id")
  revokeInvite(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partner.revokeInvite({ inviteId: id, user })
  }

  @Patch(":memberId")
  updateMember(
    @Param("memberId") memberId: string,
    @Body(new ZodValidationPipe(memberUpdateSchema)) body: MemberUpdateInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.partner.updateMember({ memberId, body, user })
  }

  /**
   * Removing somebody from the team.
   *
   * A real DELETE, unlike everywhere else in this API — a membership is a
   * grant of access, not a record of something that happened, and revoking it
   * should leave nothing behind that a future query could mistake for access.
   * The audit of what they DID lives on the bookings and events they touched.
   */
  @Delete(":memberId")
  removeMember(@Param("memberId") memberId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.partner.removeMember({ memberId, user })
  }
}

/**
 * Accepting an invitation.
 *
 * Under `/partner` but NOT `@Roles("partner")`: the person accepting is a
 * customer until the moment they accept, and requiring the partner role would
 * make the invitation impossible to use.
 *
 * Authentication IS required — they must be signed in as the invited address,
 * or a forwarded link would let anybody join somebody else's organisation.
 */
@Controller("partner/invites")
export class PartnerInviteController {
  constructor(private readonly partner: PartnerService) {}

  @Post("accept")
  @AuthThrottle()
  accept(
    @Body(new ZodValidationPipe(inviteAcceptSchema)) body: InviteAcceptInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.partner.acceptInvite({ token: body.token, user })
  }
}

/**
 * Onboarding a partner (rule #59).
 *
 * Until the join wizard lands this is the only way an organisation exists —
 * and it is not a stopgap: every marketplace signs its first properties one at
 * a time, with a person on each end.
 */
@Controller("admin/partner-orgs")
@AdminResource("clients")
@Roles("admin")
export class AdminPartnerOrgsController {
  constructor(private readonly partner: PartnerService) {}

  @Get()
  list(@Query(new ZodValidationPipe(orgListSchema)) query: OrgListInput) {
    return this.partner.listOrgs(query)
  }

  @Post()
  create(@Body(new ZodValidationPipe(orgCreateSchema)) body: OrgCreateInput) {
    return this.partner.createOrg(body)
  }

  /**
   * The platform's own settings (rule #106).
   *
   * Declared BEFORE `:orgId` — Nest matches in order, and "settings" would
   * otherwise be read as an organisation id.
   */
  @Get("settings")
  settings() {
    return this.partner.settings()
  }

  @Patch("settings")
  saveSettings(
    @Body(new ZodValidationPipe(platformSettingsSchema)) body: PlatformSettingsInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    return this.partner.saveSettings({ patch: body, user, ip })
  }

  /** One client: the organisation, its properties and its people. */
  @Get(":orgId")
  detail(@Param("orgId") orgId: string) {
    return this.partner.adminOrgDetail(orgId)
  }

  /** The platform's side of the agreement: status, plan, commission. */
  @Patch(":orgId")
  update(
    @Param("orgId") orgId: string,
    @Body(new ZodValidationPipe(orgAdminUpdateSchema)) body: OrgAdminUpdateInput
  ) {
    return this.partner.adminUpdateOrg({ orgId, patch: body })
  }
}
