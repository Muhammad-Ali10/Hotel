import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type {
  ContractAcceptInput,
  ContractTemplateInput,
  ContractTemplateView,
  ContractTerminateInput,
  PartnerContractView,
  PartnerContractsView,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { AuditService } from "../admin/audit.service"
import { ContractsRepository, type ContractRow, type TemplateRow } from "./contracts.repository"

/**
 * The agreements a partner signs (rule #98).
 *
 * Two sides: the platform publishes versions, a partner accepts them. Nothing
 * here edits a signature — an agreement is superseded or terminated, and both
 * are recorded rather than written over. The database refuses the alternative.
 */
@Injectable()
export class ContractsService {
  constructor(
    private readonly repo: ContractsRepository,
    private readonly audit: AuditService
  ) {}

  /* -------------------------------------------------------------- partner */

  /**
   * What this organisation has signed, and what it still has to.
   *
   * `outstanding` is the part that matters operationally: an active version of
   * a kind they are not on. A screen listing only what was signed cannot tell
   * a partner there is something waiting.
   */
  async forOrg(user: AuthenticatedUser): Promise<PartnerContractsView> {
    const orgId = this.orgOf(user)

    const [signed, active] = await Promise.all([
      this.repo.listForOrg(orgId),
      this.repo.listTemplates({ activeOnly: true }),
    ])

    const acceptedTemplates = new Set(
      signed.filter((row) => row.status === "accepted").map((row) => row.templateId)
    )

    return {
      signed: signed.map(toContractView),
      outstanding: active
        .filter((template) => !acceptedTemplates.has(template.id))
        .map(toTemplateView),
    }
  }

  async detail(input: { user: AuthenticatedUser; contractId: string }) {
    const row = await this.repo.findContract({
      id: input.contractId,
      // Scoped in the QUERY, not checked after: a 404 for somebody else's
      // agreement, never a 403, which would confirm the id is real (API1).
      ...(input.user.role === "admin" ? {} : { orgId: this.orgOf(input.user) }),
    })
    if (!row) throw new NotFoundException("Agreement not found")
    return toContractView(row)
  }

  /**
   * Accepting a version.
   *
   * Only an org admin — a manager or front-desk member binding the company to
   * a commercial agreement is exactly the authority `partner_members.role`
   * exists to separate (rule #14).
   *
   * Idempotent: a second click returns the signature that already exists
   * rather than writing a second one or failing.
   */
  async accept(input: {
    user: AuthenticatedUser
    templateId: string
    body: ContractAcceptInput
    ip?: string | null
  }): Promise<PartnerContractView> {
    const orgId = this.orgOf(input.user)
    if (input.user.partner?.role !== "admin") {
      throw new ForbiddenException("Only an organisation admin can accept an agreement")
    }

    const template = await this.repo.findTemplate(input.templateId)
    if (!template) throw new NotFoundException("Agreement not found")
    if (!template.active) {
      throw new BadRequestException("This version has been replaced. Reload to see the current one.")
    }

    const created = await this.repo.accept({
      orgId,
      templateId: template.id,
      // Copied, not referenced. What was agreed to must not change if the
      // template is ever edited underneath it.
      kind: template.kind,
      version: template.version,
      title: template.title,
      body: template.body,
      acceptedByUserId: input.user.id,
      acceptedByName: input.body.acceptedByName,
      acceptedIp: input.ip ?? null,
    })

    if (!created) {
      const existing = await this.repo.findAcceptance({ orgId, templateId: template.id })
      return toContractView(existing!)
    }

    await this.audit.record({
      actor: input.user,
      action: "contract.accept",
      subjectType: "partner_contract",
      subjectId: created.id,
      reason: `${template.title} v${template.version}`,
      metadata: { orgId, kind: template.kind, version: template.version },
      ip: input.ip,
    })

    return toContractView(created)
  }

  /* ------------------------------------------------------------- platform */

  listTemplates(query: { kind?: string; activeOnly?: boolean }) {
    return this.repo.listTemplates(query).then((rows) => rows.map(toTemplateView))
  }

  /**
   * Publishing a version.
   *
   * `supersedes` is what makes this a replacement rather than a new agreement:
   * the old template stops being offered, and every organisation still on it
   * is marked superseded so their next visit shows something outstanding.
   *
   * The old TEMPLATE row is never deleted — signatures point at it, and the
   * question "what did version 1 actually say" has to keep having an answer.
   */
  async publish(input: {
    body: ContractTemplateInput
    user: AuthenticatedUser
    ip?: string | null
  }): Promise<ContractTemplateView> {
    let replaced: TemplateRow | null = null
    if (input.body.supersedes) {
      replaced = await this.repo.findTemplate(input.body.supersedes)
      if (!replaced) throw new NotFoundException("The version being replaced was not found")
      if (replaced.kind !== input.body.kind) {
        throw new BadRequestException("A version can only replace one of the same kind")
      }
    }

    const version = await this.repo.nextVersion(input.body.kind)
    const template = await this.repo.createTemplate({
      kind: input.body.kind,
      version,
      title: input.body.title,
      body: input.body.body,
      effectiveFrom: input.body.effectiveFrom,
    })

    if (replaced) {
      await this.repo.deactivateTemplate(replaced.id)

      /*
       * Everyone on the old version is marked superseded, one row at a time.
       *
       * A single UPDATE would be faster and would also walk straight through
       * the trigger's own reasoning — this is a lifecycle change, so it is
       * allowed, but doing it per row keeps the reason attached to each
       * signature rather than to a batch nobody can trace back.
       */
      const live = await this.repo.liveOfKind(replaced.kind)
      for (const row of live.filter((r) => r.templateId === replaced!.id)) {
        await this.repo.endContract({
          id: row.id,
          status: "superseded",
          reason: `Replaced by ${template.title} v${version}`,
        })
      }
    }

    await this.audit.record({
      actor: input.user,
      action: "contract.publish",
      subjectType: "contract_template",
      subjectId: template.id,
      reason: `${template.title} v${version}`,
      metadata: { kind: template.kind, version, supersedes: replaced?.id ?? null },
      ip: input.ip,
    })

    return toTemplateView(template)
  }

  /** One organisation's agreements, for the platform's client page. */
  listForOrg(orgId: string) {
    return this.repo.listForOrg(orgId).then((rows) => rows.map(toContractView))
  }

  /**
   * Ending one agreement with one partner (rule #78).
   *
   * The platform's decision, never the partner's: an agreement one side can
   * walk away from by clicking is not an agreement. A reason is required and
   * audited.
   */
  async terminate(input: {
    contractId: string
    body: ContractTerminateInput
    user: AuthenticatedUser
    ip?: string | null
  }) {
    const row = await this.repo.findContract({ id: input.contractId })
    if (!row) throw new NotFoundException("Agreement not found")
    if (row.status !== "accepted") {
      throw new BadRequestException("This agreement is not live")
    }

    const updated = await this.repo.endContract({
      id: row.id,
      status: "terminated",
      reason: input.body.reason,
    })

    await this.audit.record({
      actor: input.user,
      action: "contract.terminate",
      subjectType: "partner_contract",
      subjectId: row.id,
      reason: input.body.reason,
      metadata: { orgId: row.orgId, kind: row.kind, version: row.version },
      ip: input.ip,
    })

    return toContractView(updated!)
  }

  /* ---------------------------------------------------------------- local */

  private orgOf(user: AuthenticatedUser): string {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    return user.partner.orgId
  }
}

/* ============================================================== internals == */

function toTemplateView(row: TemplateRow): ContractTemplateView {
  return {
    id: row.id,
    kind: row.kind as ContractTemplateView["kind"],
    version: row.version,
    title: row.title,
    body: row.body,
    active: row.active,
    effectiveFrom: row.effectiveFrom,
    createdAt: row.createdAt,
  }
}

function toContractView(row: ContractRow): PartnerContractView {
  return {
    id: row.id,
    templateId: row.templateId,
    kind: row.kind as PartnerContractView["kind"],
    version: row.version,
    title: row.title,
    body: row.body,
    status: row.status as PartnerContractView["status"],
    acceptedAt: row.acceptedAt,
    acceptedByName: row.acceptedByName,
    expiresAt: row.expiresAt,
    endedAt: row.endedAt,
    endedReason: row.endedReason,
  }
}
