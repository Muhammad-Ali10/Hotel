import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common"
import {
  bedCapacity,
  bedSummary,
  paymentModeFor,
  policyForPreset,
  submissionGaps,
  type RegistrationDecisionInput,
  type RegistrationDocumentInput,
  type RegistrationDocumentView,
  type RegistrationDraft,
  type RegistrationPatchInput,
  type RegistrationSearchInput,
  type RegistrationUnit,
  type RegistrationView,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { AuditService } from "../admin/audit.service"
import { NotificationsService } from "../notifications/notifications.service"
import { STORAGE_PROVIDER, type StorageProvider } from "../storage/provider/storage.provider"
import { CatalogRepository } from "../catalog/catalog.repository"
import { RegistrationSubmitRepository } from "./registration-submit.repository"
import {
  RegistrationRepository,
  type DocumentRow,
  type RegistrationRow,
} from "./registration.repository"

/** What a verification document may be, and how big. */
const DOCUMENT_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  maxPerRegistration: 20,
} as const

/**
 * Listing photographs, which travel the same upload path but are not documents.
 *
 * A separate cap on purpose. Sharing the twenty would mean a partner who
 * uploads twenty photographs cannot then upload the ownership document their
 * application is refused without — two unrelated things competing for one
 * allowance.
 *
 * No PDF. A PDF is a fine deed of ownership and is not a photograph of a
 * bedroom; accepting one here would put a document into a listing gallery that
 * no guest's browser will render as an image.
 */
const PHOTO_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp"],
  maxPerRegistration: 30,
  /**
   * A listing goes live the moment it is approved (`status: "active"`), so a
   * property with no photographs is one a guest is shown and cannot judge.
   * One is the floor, not the recommendation — the screen asks for more.
   */
  minimumToSubmit: 1,
} as const

/** How long a partner has to actually push the bytes. */
const UPLOAD_WINDOW_SECONDS = 15 * 60

/**
 * Module 12 — the registration wizard (rule #103).
 *
 * The draft is a document; `submit` hands it to the platform; approval is the
 * transaction that turns it into an organisation, a property, its rooms and
 * its rate plans. Nothing real exists until then.
 */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name)

  constructor(
    private readonly repo: RegistrationRepository,
    private readonly submitRepo: RegistrationSubmitRepository,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly catalog: CatalogRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider
  ) {}

  /* ---------------------------------------------------------- the partner */

  /**
   * Where they got to, or a fresh draft.
   *
   * Created on first read rather than by a separate "start" call: the wizard's
   * step 5 is simply the first screen after the account exists, and making the
   * client remember to announce itself is a call somebody will forget.
   */
  async mine(user: AuthenticatedUser): Promise<RegistrationView> {
    const row = await this.repo.ensureFor(user.id)
    return this.toView(row)
  }

  /**
   * Saving one screen.
   *
   * Refused once submitted. A draft that could still be edited while the
   * platform is reviewing it means the thing being approved is not the thing
   * that was read.
   */
  async patch(input: {
    user: AuthenticatedUser
    body: RegistrationPatchInput
  }): Promise<RegistrationView> {
    const row = await this.repo.ensureFor(input.user.id)
    this.assertEditable(row)

    const updated = await this.repo.patch({
      id: row.id,
      patch: input.body.data,
      ...(input.body.step !== undefined ? { step: input.body.step } : {}),
    })
    return this.toView(updated!)
  }

  /**
   * Handing it to the platform.
   *
   * Every gap is reported at once — a partner told one thing at a time, after
   * thirty-one screens, learns the form has been lying about how much is left.
   */
  async submit(user: AuthenticatedUser): Promise<RegistrationView> {
    const row = await this.repo.ensureFor(user.id)
    this.assertEditable(row)

    const draft = row.data as RegistrationDraft
    const [photoGaps, accountGaps] = await Promise.all([
      this.photoGaps(row.id),
      this.accountGaps(row.userId),
    ])
    const gaps = [...submissionGaps(draft), ...photoGaps, ...accountGaps]
    if (gaps.length > 0) {
      throw new BadRequestException({
        message: "This registration is not finished yet",
        code: "incomplete",
        gaps,
      })
    }

    const updated = await this.repo.update(row.id, {
      status: "submitted",
      submittedAt: new Date().toISOString(),
      currentStep: 31,
    })

    return this.toView(updated!)
  }

  /* -------------------------------------------------------------- documents */

  /**
   * A place to PUT one file (rule #73, same shape as a listing photo).
   *
   * No bytes ever come through this API. The type and the size are checked
   * BEFORE a URL is handed out, so a 40MB scan is refused in a round trip
   * rather than after the upload.
   */
  async uploadUrl(input: { user: AuthenticatedUser; body: RegistrationDocumentInput }) {
    const row = await this.repo.ensureFor(input.user.id)
    this.assertEditable(row)

    /*
     * Photographs and documents are checked against their own rules — and
     * counted separately, so neither can exhaust the other's allowance.
     */
    const isPhoto = input.body.kind === "photo"
    const limits = isPhoto ? PHOTO_LIMITS : DOCUMENT_LIMITS

    if (!limits.types.includes(input.body.contentType as never)) {
      throw new BadRequestException(
        isPhoto
          ? `Upload a JPEG, PNG or WebP — ${input.body.contentType} is not an image`
          : `Upload a JPEG, PNG, WebP or PDF — ${input.body.contentType} is not one`
      )
    }
    if (input.body.size > limits.maxBytes) {
      throw new BadRequestException(
        `Files must be ${limits.maxBytes / (1024 * 1024)}MB or smaller`
      )
    }

    const count = await this.repo.countDocuments(row.id, isPhoto ? "photo" : "document")
    if (count >= limits.maxPerRegistration) {
      throw new BadRequestException(
        isPhoto
          ? `You can upload up to ${limits.maxPerRegistration} photos`
          : `You can upload up to ${limits.maxPerRegistration} documents`
      )
    }

    const key = documentKey(row.id, input.body.fileName)
    const upload = await this.storage.presignUpload({
      key,
      contentType: input.body.contentType,
      // Enforced by the STORAGE layer as well as here: a client that skips
      // straight to the presigned URL with a larger file still gets refused.
      maxBytes: DOCUMENT_LIMITS.maxBytes,
      expiresInSeconds: UPLOAD_WINDOW_SECONDS,
    })

    return { ...upload, key }
  }

  /**
   * Confirming the bytes landed.
   *
   * A separate call because the upload goes to storage, not here — this is the
   * partner telling us it worked. A row that was never confirmed is an
   * abandoned upload and simply does not exist as a document.
   */
  async confirmDocument(input: {
    user: AuthenticatedUser
    body: RegistrationDocumentInput & { key: string }
  }) {
    const row = await this.repo.ensureFor(input.user.id)
    this.assertEditable(row)

    // The key must be one this registration was given, or a partner could
    // claim any object in the bucket as their own document.
    if (!input.body.key.startsWith(documentPrefix(row.id))) {
      throw new BadRequestException("That upload does not belong to this registration")
    }

    const created = await this.repo.addDocument({
      registrationId: row.id,
      kind: input.body.kind,
      fileName: input.body.fileName,
      contentType: input.body.contentType,
      storageKey: input.body.key,
    })

    return this.toDocumentView(created)
  }

  async removeDocument(input: { user: AuthenticatedUser; documentId: string }) {
    const row = await this.repo.ensureFor(input.user.id)
    this.assertEditable(row)

    const doc = await this.repo.findDocument({
      documentId: input.documentId,
      registrationId: row.id,
    })
    if (!doc) throw new NotFoundException("Document not found")

    await this.submitRepo.deleteDocument(doc.id)
    await this.storage.remove(doc.storageKey)
    return { removed: true as const }
  }

  /* --------------------------------------------------------- the platform */

  async list(query: RegistrationSearchInput) {
    const { rows, nextCursor } = await this.repo.list(query)

    return {
      items: rows.map((row) => {
        const data = (row.data ?? {}) as RegistrationDraft
        return {
          id: row.id,
          status: row.status as RegistrationView["status"],
          currentStep: row.current_step,
          propertyName: data.propertyName ?? "",
          city: data.city ?? "",
          country: data.country ?? "",
          applicantName: row.applicant_name,
          applicantEmail: row.applicant_email,
          documents: row.documents,
          submittedAt: row.submitted_at,
          createdAt: row.created_at,
        }
      }),
      nextCursor,
    }
  }

  async detail(registrationId: string): Promise<RegistrationView> {
    const row = await this.repo.findById(registrationId)
    if (!row) throw new NotFoundException("Registration not found")
    return this.toView(row)
  }

  async reviewDocument(input: {
    documentId: string
    status: "approved" | "rejected"
    note: string
    user: AuthenticatedUser
    ip?: string | null
  }) {
    const doc = await this.repo.findDocument({ documentId: input.documentId })
    if (!doc) throw new NotFoundException("Document not found")

    const updated = await this.repo.reviewDocument({
      documentId: doc.id,
      status: input.status,
      note: input.note,
    })

    await this.audit.record({
      actor: input.user,
      action: `registration.document_${input.status}`,
      subjectType: "partner_registration",
      subjectId: doc.registrationId,
      reason: input.note,
      metadata: { documentId: doc.id, kind: doc.kind },
      ip: input.ip,
    })

    return this.toDocumentView(updated!)
  }

  /**
   * The verdict — and, on approval, the transaction that creates everything.
   *
   * Approving does NOT send the listing round the review queue again. The
   * platform has just read the whole thing: the property, its rooms, its
   * prices and the applicant's documents. Reviewing the same content twice
   * would only teach whoever does it to stop reading.
   */
  async decide(input: {
    registrationId: string
    body: RegistrationDecisionInput
    user: AuthenticatedUser
    ip?: string | null
  }): Promise<RegistrationView> {
    const row = await this.repo.findById(input.registrationId)
    if (!row) throw new NotFoundException("Registration not found")
    if (row.status !== "submitted") {
      throw new ConflictException(
        row.status === "in_progress"
          ? "This registration has not been submitted yet"
          : "This registration has already been decided"
      )
    }

    if (input.body.decision === "reject") {
      const updated = await this.repo.update(row.id, {
        status: "rejected",
        decidedAt: new Date().toISOString(),
        decisionNote: input.body.note,
      })
      await this.recordDecision(row, input, null)
      await this.notifyApplicant(row, "rejected", input.body.note)
      return this.toView(updated!)
    }

    const draft = row.data as RegistrationDraft

    /*
     * Re-checked at approval, not only at submit.
     *
     * Time passes between the two, and an amenity slug the platform retired in
     * between would otherwise fail halfway through the transaction — after the
     * organisation had been created.
     */
    const gaps = submissionGaps(draft)
    if (gaps.length > 0) {
      throw new BadRequestException({
        message: "This registration is no longer complete",
        code: "incomplete",
        gaps,
      })
    }

    const created = await this.submitRepo.createEverything({
      userId: row.userId,
      registrationId: row.id,
      draft,
      units: buildUnits(draft),
      applicantName: await this.applicantName(row.userId),
    })

    /*
     * The "from" price is derived, not declared.
     *
     * `createEverything` sets it from the cheapest UNIT, which is the price the
     * applicant typed — but the same transaction also creates a non-refundable
     * plan at a discount off it, and that is the cheapest thing a guest can
     * actually book. So the listing went live advertising a price higher than
     * its own cheapest rate.
     *
     * Not cosmetic: search filters on this column (`minPrice` / `maxPrice`), so
     * a property bookable at $369 was missing from "under $400" — losing the
     * bookings it should have won, silently, from its first day.
     *
     * `recomputeBasePrice` is the canonical derivation and says of itself that
     * it is "never set by hand". This is where approval stops doing that.
     */
    await this.catalog.recomputeBasePrice(created.propertyId)

    const updated = await this.repo.update(row.id, {
      status: "approved",
      decidedAt: new Date().toISOString(),
      decisionNote: input.body.note,
      orgId: created.orgId,
      propertyId: created.propertyId,
      /*
       * The bank details do not outlive the application.
       *
       * A full IBAN and SWIFT sat in this JSON column indefinitely, for every
       * approved partner, while the payout account the details BECAME keeps
       * only the last four digits on purpose. Keeping the complete number in a
       * general-purpose document, readable by every administrator with the
       * registrations queue open, undoes that decision quietly.
       *
       * The account exists by this point and carries what the platform needs.
       * The holder's name and the bank stay — they are what a reviewer looking
       * back at an old application needs to recognise it.
       */
      data: { ...draft, iban: "", swift: "" },
    })

    await this.recordDecision(row, input, created)
    await this.notifyApplicant(row, "approved", input.body.note)

    return this.toView(updated!)
  }

  /* ---------------------------------------------------------------- local */

  private assertEditable(row: RegistrationRow) {
    if (row.status === "in_progress") return
    throw new ConflictException(
      row.status === "submitted"
        ? "This registration is with the platform for review"
        : "This registration has already been decided"
    )
  }

  private async applicantName(userId: string): Promise<string> {
    const person = await this.submitRepo.findUser(userId)
    if (!person) throw new NotFoundException("Applicant not found")
    return `${person.firstName} ${person.lastName}`.trim() || person.email
  }

  private async recordDecision(
    row: RegistrationRow,
    input: { body: RegistrationDecisionInput; user: AuthenticatedUser; ip?: string | null },
    created: { orgId: string; propertyId: string } | null
  ) {
    await this.audit.record({
      actor: input.user,
      action: `registration.${input.body.decision}`,
      subjectType: "partner_registration",
      subjectId: row.id,
      reason: input.body.note,
      metadata: created ? { ...created } : {},
      ip: input.ip,
    })
  }

  private async notifyApplicant(
    row: RegistrationRow,
    outcome: "approved" | "rejected",
    note: string
  ) {
    const person = await this.submitRepo.findUser(row.userId)
    if (!person) return

    /*
     * A failed notification must not undo an approval that has already created
     * an organisation. The decision is the fact; the email is a courtesy, and
     * it is queued in the outbox where a retry can pick it up.
     */
    try {
      await this.notifications.notify({
        template: outcome === "approved" ? "registration_approved" : "registration_rejected",
        subjectId: row.id,
        userId: person.id,
        toEmail: person.email,
        payload: { note, propertyName: (row.data as RegistrationDraft).propertyName ?? "" },
      })
    } catch (error) {
      this.logger.warn(`Could not queue the ${outcome} email: ${(error as Error).message}`)
    }
  }

  /**
   * What is missing that is not IN the draft.
   *
   * `submissionGaps` is pure over the draft, which is what makes it shared with
   * the frontend and testable without a database — so a requirement about the
   * ACCOUNT cannot live there. It is appended here instead, in the same list,
   * because a partner does not care which side of that line a missing thing
   * falls on: they care what is left to do.
   */
  private async accountGaps(userId: string): Promise<string[]> {
    const verified = await this.repo.emailVerified(userId)
    return verified ? [] : ["Confirm your email address"]
  }

  /**
   * Photographs are documents on this side of approval, so this gap cannot live
   * in `submissionGaps` either — the draft does not know about them.
   */
  private async photoGaps(registrationId: string): Promise<string[]> {
    const count = await this.repo.countDocuments(registrationId, "photo")
    return count >= PHOTO_LIMITS.minimumToSubmit
      ? []
      : ["Add at least one photo of the property"]
  }

  private async toView(row: RegistrationRow): Promise<RegistrationView> {
    const [documents, commissionRateBps, accountGaps, photoGaps] = await Promise.all([
      this.repo.documentsFor(row.id),
      this.repo.defaultCommissionRateBps(),
      this.accountGaps(row.userId),
      this.photoGaps(row.id),
    ])
    const draft = (row.data ?? {}) as RegistrationDraft

    return {
      id: row.id,
      status: row.status as RegistrationView["status"],
      currentStep: row.currentStep,
      data: draft,
      gaps: [...submissionGaps(draft), ...photoGaps, ...accountGaps],
      documents: documents.map((doc) => this.toDocumentView(doc)),
      submittedAt: row.submittedAt,
      decidedAt: row.decidedAt,
      decisionNote: row.decisionNote,
      orgId: row.orgId,
      propertyId: row.propertyId,
      commissionRateBps,
    }
  }

  private toDocumentView(row: DocumentRow): RegistrationDocumentView {
    return {
      id: row.id,
      kind: row.kind as RegistrationDocumentView["kind"],
      status: row.status as RegistrationDocumentView["status"],
      fileName: row.fileName,
      url: this.storage.publicUrl(row.storageKey),
      reviewedAt: row.reviewedAt,
      reviewNote: row.reviewNote,
      createdAt: row.createdAt,
    }
  }
}

/* ============================================================== internals == */

const documentPrefix = (registrationId: string) => `registrations/${registrationId}/`

function documentKey(registrationId: string, fileName: string): string {
  /*
   * The partner's file name never reaches the key.
   *
   * It is attacker-controlled text going into a path, and the name is already
   * stored in a column where it is only ever displayed. A random suffix keeps
   * two uploads of "passport.pdf" apart.
   */
  const extension = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "bin"
  const safe = extension.replace(/[^a-z0-9]/g, "").slice(0, 8) || "bin"
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
  return `${documentPrefix(registrationId)}${unique}.${safe}`
}

export type BuiltUnit = {
  name: string
  description: string
  maxAdults: number
  maxChildren: number
  maxOccupancy: number
  bed: string
  size: number
  features: string[]
  units: number
  price: number
  extraPlanDiscount: number | null
}

/**
 * The wizard's units, as rooms.
 *
 * `maxChildren` is set to the same number as `maxAdults`, NOT to zero. The
 * wizard asks one question — "how many guests" — and zero would mean "this
 * room cannot accommodate children", a restriction the partner never chose and
 * would not discover until a family failed to book. The total cap is the limit
 * they actually stated; the extranet is where they narrow it if they want to.
 */
function buildUnits(draft: RegistrationDraft): BuiltUnit[] {
  return (draft.units ?? []).map((unit: RegistrationUnit, index) => {
    const guests = Math.max(1, unit.guests ?? 1, bedCapacity(unit))
    return {
      name: unit.name?.trim() || unit.unitType?.trim() || `Room ${index + 1}`,
      description: "",
      maxAdults: unit.guests ?? guests,
      maxChildren: unit.guests ?? guests,
      maxOccupancy: guests,
      bed: bedSummary(unit),
      // The wizard collects a free-text size ("32 m²"); only the number is
      // stored, and an unparseable answer is no answer rather than a zero
      // presented as a fact.
      size: parseSize(unit.size),
      features: roomFeatures(unit),
      units: unit.unitCount ?? 1,
      price: unit.price ?? 0,
      extraPlanDiscount: unit.ratePlan?.enabled ? (unit.ratePlan.discount ?? 0) : null,
    }
  })
}

function parseSize(value?: string): number {
  const match = value?.match(/\d+/)
  return match ? Number(match[0]) : 0
}

/**
 * Everything the wizard asked about a room, as the room's feature list.
 *
 * Three of the sub-flow's answers used to go nowhere. The bathroom screen
 * (step 16) refused to continue until a partner said whether the bathroom was
 * private, then listed ten fittings to tick — and neither the answer nor the
 * fittings were carried past the draft. Smoking (step 14) was the same.
 *
 * `rooms.features` is a free-form list, which is exactly what these are: things
 * a guest reads on the room before choosing it. Ordered so the private/shared
 * answer comes first, because it is the one that changes a decision.
 */
function roomFeatures(unit: RegistrationUnit): string[] {
  const features: string[] = []

  if (unit.bathroomPrivate === true) features.push("Private bathroom")
  if (unit.bathroomPrivate === false) features.push("Shared bathroom")

  features.push(...(unit.bathroomItems ?? []))
  features.push(...(unit.amenities ?? []))

  /*
   * Stated either way. "Non-smoking" is a fact a guest looks for, and its
   * absence is not the same as its negation — a room list with nothing about
   * smoking tells a guest with an allergy nothing at all.
   */
  features.push(unit.smoking ? "Smoking allowed" : "Non-smoking")

  // Case-insensitive, because "Shower" from the bathroom list and "shower" from
  // the room list are one feature, not two.
  const seen = new Set<string>()
  return features.filter((feature) => {
    const key = feature.trim().toLowerCase()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** The structured policy behind the wizard's chosen preset (rule #102). */
export function policyForDraft(draft: RegistrationDraft) {
  return policyForPreset(draft.cancellationPolicy ?? "moderate")
}

/** The wizard's word for who takes the money, in the API's (rule #42). */
export function paymentModeForDraft(draft: RegistrationDraft) {
  return paymentModeFor(draft.paymentMethod ?? "platform")
}
