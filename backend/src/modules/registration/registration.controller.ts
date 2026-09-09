import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query } from "@nestjs/common"
import {
  registrationDecisionSchema,
  registrationDocumentSchema,
  registrationPatchSchema,
  registrationSearchSchema,
  type RegistrationDecisionInput,
  type RegistrationDocumentInput,
  type RegistrationPatchInput,
  type RegistrationSearchInput,
} from "@stayora/shared"
import { z } from "zod"

import { AdminResource, CurrentUser, Roles } from "../../common/auth/decorators"
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe"
import type { AuthenticatedUser } from "../auth/auth.service"
import { RegistrationService } from "./registration.service"

const confirmSchema = registrationDocumentSchema.extend({
  key: z.string().trim().min(1).max(512),
})

type ConfirmInput = z.infer<typeof confirmSchema>

const reviewSchema = z
  .object({
    status: z.enum(["approved", "rejected"]),
    note: z.string().trim().max(2000).default(""),
  })
  .strict()

type ReviewInput = z.infer<typeof reviewSchema>

/**
 * The registration wizard, partner side (Module 12).
 *
 * Authenticated but role-free, and deliberately: steps 1–4 create an ordinary
 * account, and the person filling this in is not a partner yet — they become
 * one when the platform approves it. `@Roles("partner")` here would lock every
 * applicant out of the form that makes them a partner.
 *
 * There is no `:id` anywhere. A registration is always the caller's own, which
 * is the access control: a route that cannot name somebody else's cannot be
 * asked for it (API1).
 */
@Controller("join/registration")
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  /** Where they got to. Creates the draft on first read. */
  @Get()
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.registration.mine(user)
  }

  @Patch()
  patch(
    @Body(new ZodValidationPipe(registrationPatchSchema)) body: RegistrationPatchInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.registration.patch({ user, body })
  }

  @Post("submit")
  submit(@CurrentUser() user: AuthenticatedUser) {
    return this.registration.submit(user)
  }

  /* ------------------------------------------------------------- documents */

  /** A place to PUT one file. No bytes come through this API (rule #73). */
  @Post("documents/upload-url")
  uploadUrl(
    @Body(new ZodValidationPipe(registrationDocumentSchema)) body: RegistrationDocumentInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.registration.uploadUrl({ user, body })
  }

  @Post("documents")
  confirm(
    @Body(new ZodValidationPipe(confirmSchema)) body: ConfirmInput,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.registration.confirmDocument({ user, body })
  }

  @Delete("documents/:documentId")
  remove(
    @Param("documentId") documentId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.registration.removeDocument({ user, documentId })
  }
}

/**
 * The platform's side: the queue, the documents, and the verdict.
 *
 * Approving is the only route in this API that creates an organisation, a
 * property, its rooms and its rate plans in one transaction — see
 * `RegistrationSubmitRepository`.
 */
@Controller("admin/registrations")
@AdminResource("clients")
@Roles("admin")
export class AdminRegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Get()
  list(@Query(new ZodValidationPipe(registrationSearchSchema)) query: RegistrationSearchInput) {
    return this.registration.list(query)
  }

  @Get(":registrationId")
  detail(@Param("registrationId") registrationId: string) {
    return this.registration.detail(registrationId)
  }

  @Post("documents/:documentId/review")
  reviewDocument(
    @Param("documentId") documentId: string,
    @Body(new ZodValidationPipe(reviewSchema)) body: ReviewInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    return this.registration.reviewDocument({ documentId, ...body, user, ip })
  }

  @Post(":registrationId/decision")
  decide(
    @Param("registrationId") registrationId: string,
    @Body(new ZodValidationPipe(registrationDecisionSchema)) body: RegistrationDecisionInput,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string
  ) {
    return this.registration.decide({ registrationId, body, user, ip })
  }
}
