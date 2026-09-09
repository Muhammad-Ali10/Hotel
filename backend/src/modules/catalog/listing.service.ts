import { extname } from "node:path"

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type {
  AdminPropertyRow,
  AdminPropertySearchInput,
  AmenityUpsertInput,
  ListingDecisionInput,
  PhotoConfirmInput,
  PhotoUpdateInput,
  PhotoUploadRequestInput,
  PhotoView,
  PropertyCreateInput,
  PropertySuspensionInput,
} from "@stayora/shared"
import {
  MATERIAL_FIELDS,
  materialChanges,
  needsReview,
  PHOTO_LIMITS,
  listingScore,
  photoRejection,
  publishGaps,
  type MaterialField,
} from "@stayora/shared"

import type { AuthenticatedUser } from "../auth/auth.service"
import { AuditService } from "../admin/audit.service"
import { photoKey } from "../storage/provider/fake-storage.provider"
import { STORAGE_PROVIDER, type StorageProvider } from "../storage/provider/storage.provider"
import { ListingRepository, type PhotoRow, type PropertyRow } from "./listing.repository"

/** How long a partner has to actually push the bytes. */
const UPLOAD_WINDOW_SECONDS = 15 * 60

@Injectable()
export class ListingService {
  constructor(
    private readonly repo: ListingRepository,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    // Suspending a listing and approving one are decisions somebody has to be
    // able to answer for later (rule #77).
    private readonly audit: AuditService
  ) {}

  /* ------------------------------------------------------------- create -- */

  /**
   * A partner creating their own listing (rule #69).
   *
   * Born `draft`: invisible to search, invisible to guests, and free to be
   * half-finished. Until this endpoint existed a property could only appear by
   * running the seed script or writing SQL by hand.
   */
  async create(input: { user: AuthenticatedUser; body: PropertyCreateInput }) {
    const scope = this.scopeOf(input.user)
    this.assertRole(input.user, ["admin", "manager"])

    const slug = await this.repo.freeSlug(slugify(input.body.name))
    const created = await this.repo.createProperty({
      ...input.body,
      slug,
      partnerOrgId: scope.orgId,
      status: "draft",
      // No `basePrice` — `NewProperty` does not have one. It is recomputed from
      // the rate plans and never accepted from a partner (rule #138); the column
      // defaults to 0 until the first plan exists.
      seed: slug,
    })

    return this.toDto(created)
  }

  /** The single-property read the extranet never had. */
  async detail(input: { user: AuthenticatedUser; propertyId: string }) {
    const property = await this.owned(input)
    const [photoRows, completeness, amenitySlugs] = await Promise.all([
      this.repo.photosFor(property.id),
      this.repo.completeness(property.id),
      this.repo.amenitySlugsFor(property.id),
    ])

    return {
      ...this.toDto(property),
      photos: photoRows.map((row) => this.toPhotoDto(row)),
      amenities: amenitySlugs,
      /*
       * What is still missing, on every read.
       *
       * So the extranet can show "3 more photos" beside the submit button
       * rather than only after a rejected attempt.
       */
      gaps: publishGaps({
        rooms: completeness.rooms,
        ratePlans: completeness.ratePlans,
        photos: completeness.photos,
        description: property.description ?? "",
      }),
    }
  }

  /* -------------------------------------------------------------- edits -- */

  /**
   * Editing a listing (rules #71, #72).
   *
   * A material change to a LIVE listing does not touch the columns. It goes
   * into `pending_changes` and waits, while search and the public detail carry
   * on serving what was approved — because a listing that vanished from search
   * every time a partner fixed a typo would cost the guests, not the partner.
   *
   * On a draft, everything applies immediately: nothing is published, so there
   * is nothing to protect.
   */
  async update(input: {
    user: AuthenticatedUser
    propertyId: string
    patch: Record<string, unknown>
  }) {
    this.assertRole(input.user, ["admin", "manager"])
    const property = await this.owned(input)

    const current = Object.fromEntries(
      MATERIAL_FIELDS.map((field) => [field, (property as Record<string, unknown>)[field]])
    ) as Partial<Record<MaterialField, unknown>>

    if (!needsReview({ status: property.status, current, patch: input.patch })) {
      const updated = await this.repo.updateProperty(property.id, input.patch)
      return this.toDto(updated ?? property)
    }

    const changed = materialChanges(current, input.patch)
    const material: Record<string, unknown> = {}
    const immediate: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input.patch)) {
      if ((changed as readonly string[]).includes(key)) material[key] = value
      else immediate[key] = value
    }

    const updated = await this.repo.updateProperty(property.id, {
      ...immediate,
      // Merged, not replaced: two edits before one review must both survive.
      pendingChanges: {
        ...((property.pendingChanges as Record<string, unknown>) ?? {}),
        ...material,
      },
    })

    return { ...this.toDto(updated ?? property), pendingReview: changed }
  }

  /**
   * Sending a listing for its first approval (rule #70).
   *
   * The gaps come back in the error, all of them. A partner told "you need
   * photos", who adds photos and is then told "you need a rate plan", learns
   * the system will keep finding reasons — and abandons the listing.
   */
  async submit(input: { user: AuthenticatedUser; propertyId: string }) {
    this.assertRole(input.user, ["admin", "manager"])
    const property = await this.owned(input)

    if (property.status === "active") {
      throw new ConflictException("This listing is already live")
    }
    if (property.status === "pending_review") {
      throw new ConflictException("This listing is already waiting for review")
    }
    if (property.status === "suspended" || property.status === "rejected") {
      throw new ForbiddenException("Contact support about this listing")
    }

    const completeness = await this.repo.completeness(property.id)
    const gaps = publishGaps({
      rooms: completeness.rooms,
      ratePlans: completeness.ratePlans,
      photos: completeness.photos,
      description: property.description ?? "",
    })

    if (gaps.length > 0) {
      throw new BadRequestException({
        code: "listing_incomplete",
        message: "This listing is not ready to submit yet",
        gaps,
      })
    }

    const updated = await this.repo.updateProperty(property.id, { status: "pending_review" })
    return this.toDto(updated!)
  }

  /* -------------------------------------------------------------- photos -- */

  /**
   * Somewhere to put one file (rule #73).
   *
   * The bytes never come through this API. What goes back is a URL the browser
   * writes to directly, signed for one key, one content type and one size — so
   * a client that declared a 2MB JPEG and then pushes a 40MB video is refused
   * by storage, not by a check here that could be skipped.
   *
   * No row is written yet. An upload that dies halfway leaves nothing behind.
   */
  async uploadUrl(input: {
    user: AuthenticatedUser
    propertyId: string
    body: PhotoUploadRequestInput
  }) {
    this.assertRole(input.user, ["admin", "manager"])
    const property = await this.owned(input)

    const existing = await this.repo.countPhotos(property.id)
    const rejection = photoRejection({
      contentType: input.body.contentType,
      bytes: input.body.bytes,
      existing,
    })
    if (rejection) throw new BadRequestException(photoRejectionMessage(rejection))

    const key = photoKey(property.id, extensionFor(input.body.contentType))
    return this.storage.presignUpload({
      key,
      contentType: input.body.contentType,
      maxBytes: input.body.bytes,
      expiresInSeconds: UPLOAD_WINDOW_SECONDS,
    })
  }

  /**
   * Recording an upload that landed.
   *
   * The key must be one this API issued FOR THIS PROPERTY. Without that check
   * a partner could confirm a key belonging to somebody else's listing and
   * attach their photo — or a key of their own choosing, pointing anywhere in
   * the bucket.
   */
  async confirmPhoto(input: {
    user: AuthenticatedUser
    propertyId: string
    body: PhotoConfirmInput
  }) {
    this.assertRole(input.user, ["admin", "manager"])
    const property = await this.owned(input)

    if (!input.body.key.startsWith(`properties/${property.id}/`)) {
      throw new BadRequestException("That upload does not belong to this property")
    }

    const existing = await this.repo.countPhotos(property.id)
    if (existing >= PHOTO_LIMITS.max) {
      throw new BadRequestException(photoRejectionMessage("too_many"))
    }

    const created = await this.repo.addPhoto({
      propertyId: property.id,
      category: input.body.category,
      caption: input.body.caption,
      position: existing,
      storageKey: input.body.key,
      contentType: contentTypeFor(input.body.key),
      width: input.body.width ?? null,
      height: input.body.height ?? null,
      // Not public until a human has looked at it (rule #73).
      status: "pending",
    })

    return this.toPhotoDto(created)
  }

  async updatePhoto(input: {
    user: AuthenticatedUser
    propertyId: string
    photoId: string
    body: PhotoUpdateInput
  }) {
    this.assertRole(input.user, ["admin", "manager"])
    const property = await this.owned(input)

    const photo = await this.repo.findPhoto({ photoId: input.photoId, propertyId: property.id })
    if (!photo) throw new NotFoundException("Photo not found")

    const updated = await this.repo.updatePhoto(photo.id, input.body)
    return this.toPhotoDto(updated!)
  }

  /**
   * Removing a photo, and the file behind it.
   *
   * The row goes first. If storage then fails, the result is an orphaned
   * object costing fractions of a cent — whereas deleting the file first and
   * failing on the row would leave a listing pointing at nothing.
   */
  async deletePhoto(input: { user: AuthenticatedUser; propertyId: string; photoId: string }) {
    this.assertRole(input.user, ["admin", "manager"])
    const property = await this.owned(input)

    const removed = await this.repo.deletePhoto({
      photoId: input.photoId,
      propertyId: property.id,
    })
    if (!removed) throw new NotFoundException("Photo not found")

    if (removed.storageKey) await this.storage.remove(removed.storageKey)
    return { removed: true as const }
  }

  /* --------------------------------------------------------- the platform */

  async queue(limit: number) {
    const rows = await this.repo.reviewQueue({ limit })
    return rows.map((row) => ({
      ...this.toDto(row),
      /** Which kind of work this is — a first approval, or an edit. */
      kind: row.status === "pending_review" ? ("new" as const) : ("changes" as const),
    }))
  }

  /**
   * The listing score, for a set of properties (rule #99).
   *
   * Both audiences come through here: the partner's own score page and the
   * platform's content screen. One computation, so the number a partner is
   * asked to improve is the number the platform is looking at.
   */
  async scoresFor(propertyIds: readonly string[]) {
    const rows = await this.repo.scoreInputs(propertyIds)
    return rows.map(({ propertyId, ...inputs }) => ({
      propertyId,
      inputs,
      ...listingScore(inputs),
    }))
  }

  /** One property's score, resolved through the caller's own portfolio. */
  async scoreFor(input: { user: AuthenticatedUser; propertyId: string }) {
    const property = await this.owned(input)
    const [score] = await this.scoresFor([property.id])
    return { ...score!, name: property.name }
  }

  /**
   * Every listing on the platform, scored (admin `content`).
   *
   * Ordered worst first: the screen exists to find the pages that need work,
   * and a list starting with the best ones buries them.
   */
  async contentQueue(query: AdminPropertySearchInput) {
    const { items, nextCursor, counts } = await this.adminList(query)
    const scores = await this.scoresFor(items.map((item) => item.id))
    const byId = new Map(scores.map((s) => [s.propertyId, s]))

    return {
      items: items
        .map((item) => ({ ...item, score: byId.get(item.id) ?? null }))
        .sort((a, b) => (a.score?.total ?? 0) - (b.score?.total ?? 0)),
      nextCursor,
      counts,
    }
  }

  /**
   * The platform's whole property list (admin `properties`).
   *
   * The review queue is a filter on this — `needsReview=true` — rather than a
   * separate endpoint returning a different shape. Two lists of the same thing
   * is how one of them ends up missing a status the other has.
   */
  async adminList(query: AdminPropertySearchInput) {
    const [{ rows, nextCursor }, counts] = await Promise.all([
      this.repo.adminList(query),
      this.repo.statusCounts(),
    ])

    const items: AdminPropertyRow[] = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      city: row.city,
      country: row.country,
      type: row.type as AdminPropertyRow["type"],
      stars: row.stars,
      status: row.status as AdminPropertyRow["status"],
      orgId: row.org_id,
      orgName: row.org_name,
      fromPrice: row.base_price,
      rooms: row.rooms,
      photos: row.photos,
      hasPendingChanges: row.has_pending,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))

    return { items, nextCursor, counts }
  }

  /**
   * One listing, from the platform's side.
   *
   * Photos of EVERY status, unlike the public detail: reviewing a photo is
   * impossible if the review screen only shows the ones already approved.
   * `ListingRepository.photosFor` returns them all — it is the CATALOGUE
   * repository that narrows to `approved`, and only for guests.
   */
  async adminDetail(propertyId: string) {
    const property = await this.repo.findById(propertyId)
    if (!property) throw new NotFoundException("Property not found")

    const [photoRows, completeness, org] = await Promise.all([
      this.repo.photosFor(property.id),
      this.repo.completeness(property.id),
      /*
       * Whose property this is.
       *
       * The partner's own version of this read does not carry it, and does not
       * need to: they can only reach their own. An admin can reach every one,
       * and "approve this hotel" without knowing which business is behind it
       * is a decision made blind. The admin LIST already names the
       * organisation, so the detail naming it too is what lets the page link
       * back instead of dead-ending.
       */
      property.partnerOrgId ? this.repo.orgNameOf(property.partnerOrgId) : null,
    ])

    return {
      ...this.toDto(property),
      orgId: property.partnerOrgId,
      orgName: org,
      photos: photoRows.map((row) => this.toPhotoDto(row)),
      /*
       * The counts behind the gaps.
       *
       * `gaps` says WHAT is missing; these say how far off it is — "2 rooms"
       * beside "needs at least one rate plan" is the difference between a
       * listing nearly ready and one nobody has started.
       */
      counts: {
        rooms: completeness.rooms,
        ratePlans: completeness.ratePlans,
        photos: completeness.photos,
      },
      gaps: publishGaps({
        rooms: completeness.rooms,
        ratePlans: completeness.ratePlans,
        photos: completeness.photos,
        description: property.description ?? "",
      }),
    }
  }

  /**
   * Taking a listing off the market, or putting it back (rules #75, #78).
   *
   * Never a delete. A suspended property keeps its bookings, its reviews and
   * its history, and the guests who already booked it are unaffected — the
   * same reasoning rule #95 uses for an unpaid invoice.
   *
   * A reason is required and audited: somebody reading this in six months has
   * to be able to understand why a hotel came off the marketplace.
   */
  async setSuspension(input: {
    propertyId: string
    body: PropertySuspensionInput
    user: AuthenticatedUser
    ip?: string | null
  }) {
    const property = await this.repo.findById(input.propertyId)
    if (!property) throw new NotFoundException("Property not found")

    if (input.body.action === "suspend") {
      if (property.status === "suspended") return this.toDto(property)
    } else if (property.status !== "suspended") {
      /*
       * Reinstating something that is not suspended would have to guess which
       * state to put it back into — `draft`? `pending_review`? — and guessing
       * could publish a listing nobody approved.
       */
      throw new BadRequestException("This listing is not suspended")
    }

    const updated = await this.repo.updateProperty(property.id, {
      status: input.body.action === "suspend" ? "suspended" : "active",
    })

    await this.audit.record({
      actor: input.user,
      action: `property.${input.body.action}`,
      subjectType: "property",
      subjectId: property.id,
      reason: input.body.reason,
      metadata: { from: property.status, to: updated!.status },
      ip: input.ip,
    })

    return this.toDto(updated!)
  }

  /**
   * The platform's verdict (rules #70–#72).
   *
   * Approving merges `pending_changes` into the columns and clears it, which
   * is the moment the public finally sees the new values. Pending photos are
   * approved in the same breath — a listing signed off with photos nobody can
   * see would be signed off with nothing.
   */
  async decide(input: {
    propertyId: string
    body: ListingDecisionInput
    user: AuthenticatedUser
    ip?: string | null
  }) {
    const property = await this.repo.findById(input.propertyId)
    if (!property) throw new NotFoundException("Property not found")

    const pending = (property.pendingChanges as Record<string, unknown> | null) ?? null

    /*
     * Recorded before the branches, so every verdict lands in the log and not
     * only the two that happen to run through a shared exit. Approving is
     * audited as well as rejecting: "why is this hotel live" is the same
     * question as "why is it not", asked by whoever is looking later.
     */
    const audit = (to: string) =>
      this.audit.record({
        actor: input.user,
        action: `listing.${input.body.decision}`,
        subjectType: "property",
        subjectId: property.id,
        reason: input.body.note,
        metadata: { from: property.status, to, hadPendingChanges: pending !== null },
        ip: input.ip,
      })

    if (input.body.decision === "approve") {
      const updated = await this.repo.updateProperty(property.id, {
        ...(pending ?? {}),
        pendingChanges: null,
        // An `active` listing being edited stays `active`; a first approval
        // is what moves a `pending_review` listing onto the market.
        status: "active",
      })
      await this.repo.approvePhotos(property.id)
      await audit("active")
      return this.toDto(updated!)
    }

    if (input.body.decision === "request_changes") {
      const updated = await this.repo.updateProperty(property.id, {
        // Rejected edits are discarded, not left to be re-approved by accident.
        pendingChanges: null,
        // A live listing sent back for changes STAYS live — the approved
        // version is still perfectly good, and pulling it would punish guests
        // for a partner's bad edit.
        status: property.status === "active" ? "active" : "changes_requested",
      })
      await audit(updated!.status)
      return this.toDto(updated!)
    }

    const updated = await this.repo.updateProperty(property.id, {
      pendingChanges: null,
      status: "rejected",
    })
    await audit("rejected")
    return this.toDto(updated!)
  }

  /* ----------------------------------------------------------- amenities -- */

  /** The vocabulary, public — the search filter is built from it (rule #74). */
  async amenities() {
    const rows = await this.repo.listAmenities()
    return rows.map((row) => ({
      slug: row.slug,
      label: row.label,
      category: row.category,
      icon: row.icon,
    }))
  }

  async upsertAmenity(body: AmenityUpsertInput) {
    const row = await this.repo.upsertAmenity(body)
    return { slug: row.slug, label: row.label, category: row.category, icon: row.icon }
  }

  /* ---------------------------------------------------------------- local */

  private async owned(input: { user: AuthenticatedUser; propertyId: string }) {
    const scope = this.scopeOf(input.user)
    const property = await this.repo.findOwned({ propertyId: input.propertyId, ...scope })
    // 404, never 403 — a 403 would confirm the id belongs to somebody (API1).
    if (!property) throw new NotFoundException("Property not found")
    return property
  }

  private scopeOf(user: AuthenticatedUser) {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    return { orgId: user.partner.orgId, propertyIds: user.partner.propertyIds }
  }

  private assertRole(user: AuthenticatedUser, allowed: ("admin" | "manager" | "staff")[]) {
    if (!user.partner) throw new ForbiddenException("This account is not linked to a property")
    if (!allowed.includes(user.partner.role as "admin" | "manager" | "staff")) {
      throw new ForbiddenException("You do not have permission to change this listing")
    }
  }

  /** Explicit fields (API3), so a new column cannot leak into a response. */
  private toDto(row: PropertyRow) {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      city: row.city,
      country: row.country,
      type: row.type,
      stars: row.stars,
      address: row.address,
      description: row.description,
      timezone: row.timezone,
      checkInTime: row.checkInTime,
      checkOutTime: row.checkOutTime,
      /*
       * The house rules.
       *
       * Cancellation is deliberately NOT among them: it belongs to a rate
       * plan (rule #1), because two rates on the same room can and do carry
       * different terms.
       */
      policyPayment: row.policyPayment,
      policyPets: row.policyPets,
      policySmoking: row.policySmoking,
      policyChildren: row.policyChildren,
      status: row.status,
      /** What is waiting for the platform, so a partner can see their own edit. */
      pendingChanges: row.pendingChanges ?? null,
      createdAt: row.createdAt,
    }
  }

  private toPhotoDto(row: PhotoRow): PhotoView {
    return {
      id: row.id,
      category: row.category,
      caption: row.caption,
      position: row.position,
      status: row.status as PhotoView["status"],
      // A seeded placeholder has no key and renders from `seed` instead.
      url: row.storageKey ? this.storage.publicUrl(row.storageKey) : null,
      seed: row.seed,
    }
  }
}

/* ------------------------------------------------------------------ local -- */

/**
 * A URL-safe handle from a hotel's name.
 *
 * Diacritics are folded rather than dropped, so "Hôtel Café" becomes
 * `hotel-cafe` and not `htel-caf` — a French hotel should not end up with a
 * slug missing half its letters.
 */
function slugify(name: string): string {
  const folded = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
  // A name of nothing but symbols still needs a handle.
  return folded || "property"
}

function extensionFor(contentType: string): string {
  if (contentType === "image/png") return "png"
  if (contentType === "image/webp") return "webp"
  return "jpg"
}

function contentTypeFor(key: string): string {
  const ext = extname(key).toLowerCase()
  if (ext === ".png") return "image/png"
  if (ext === ".webp") return "image/webp"
  return "image/jpeg"
}

function photoRejectionMessage(reason: "type" | "too_large" | "too_many"): string {
  if (reason === "type") return "Photos must be JPEG, PNG or WebP"
  if (reason === "too_large") return "Photos must be under 5MB"
  return `A listing can have at most ${PHOTO_LIMITS.max} photos`
}
