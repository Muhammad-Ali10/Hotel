import { Body, Controller, Get, Ip, Param, Post, Query } from "@nestjs/common"
import {
  CONTRACT_KINDS,
  contractAcceptSchema,
  contractTemplateSchema,
  contractTerminateSchema,
  type ContractAcceptInput,
  type ContractTemplateInput,
  type ContractTerminateInput,
} from "@stayora/shared"
import { z } from "zod"

import { AdminResource, CurrentUser, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { ContractsService } from "./contracts.service"

const templateQuerySchema = z
  .object({
    kind: z.enum(CONTRACT_KINDS).optional(),
    activeOnly: z.coerce.boolean().default(false),
  })
  .strict()

type TemplateQueryInput = z.infer<typeof templateQuerySchema>

/**
 * A partner's own agreements.
 *
 * Reading is open to any member of the organisation — everyone working there
 * should be able to see what the company signed. Accepting is not: that is an
 * org admin, checked in the service (rule #14).
 */
@Controller("partner/contracts")
@Roles("partner")
export class PartnerContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.contracts.forOrg(user)
  }

  @Get(":contractId")
  detail(@Param("contractId") contractId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.contracts.detail({ user, contractId })
  }

  /**
   * Accepting a version.
   *
   * Addressed by TEMPLATE id, not by contract id: before this call there is no
   * contract to name. The route says what is being agreed to.
   */
  @Post("templates/:templateId/accept")
  accept(
    @Param("templateId") templateId: string,
    @Body(new ZodValidationPipe(contractAcceptSchema)) body: ContractAcceptInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    return this.contracts.accept({ user, templateId, body, ip })
  }
}

/**
 * The platform's side: publishing versions and ending agreements.
 *
 * There is no route that edits a published version, and that is deliberate —
 * a change to an agreement people have signed is a NEW version, which is what
 * `supersedes` is for.
 */
@Controller("admin/contracts")
@AdminResource("clients")
@Roles("admin")
export class AdminContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Get("templates")
  templates(@Query(new ZodValidationPipe(templateQuerySchema)) query: TemplateQueryInput) {
    return this.contracts.listTemplates(query)
  }

  @Post("templates")
  publish(
    @Body(new ZodValidationPipe(contractTemplateSchema)) body: ContractTemplateInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    return this.contracts.publish({ body, user, ip })
  }

  /** One client's agreements, for the platform's client page. */
  @Get("orgs/:orgId")
  forOrg(@Param("orgId") orgId: string) {
    return this.contracts.listForOrg(orgId)
  }

  @Post(":contractId/terminate")
  terminate(
    @Param("contractId") contractId: string,
    @Body(new ZodValidationPipe(contractTerminateSchema)) body: ContractTerminateInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    return this.contracts.terminate({ contractId, body, user, ip })
  }
}
