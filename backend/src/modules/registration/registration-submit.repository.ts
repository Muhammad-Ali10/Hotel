import { Inject, Injectable, Logger } from "@nestjs/common"
import { and, asc, eq, inArray } from "drizzle-orm"
import { paymentModeFor, policyForPreset, type RegistrationDraft } from "@stayora/shared"

import { DRIZZLE, type Database } from "../../db/drizzle.module"
import {
  amenities,
  contractTemplates,
  partnerContracts,
  partnerMembers,
  partnerOrgs,
  partnerPayoutAccounts,
  photos,
  type NewProperty,
  properties,
  propertyAmenities,
  ratePlans,
  registrationDocuments,
  rooms,
  users,
} from "../../db/schema"
import type { BuiltUnit } from "./registration.service"

/**
 * The one transaction that turns a draft into a business (rule #103).
 *
 * Everything or nothing. Half of this — an organisation with no property, a
 * property with no rooms — is worse than a failed approval: the partner can
 * sign in, sees a broken account, and nobody knows what state it is meant to
 * be in.
 */
@Injectable()
export class RegistrationSubmitRepository {
  private readonly logger = new Logger(RegistrationSubmitRepository.name)

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findUser(userId: string) {
    return this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  }

  async deleteDocument(documentId: string) {
    await this.db.delete(registrationDocuments).where(eq(registrationDocuments.id, documentId))
  }

  async createEverything(input: {
    userId: string
    /** Needed for the gallery: the photos are rows against this registration. */
    registrationId: string
    draft: RegistrationDraft
    units: BuiltUnit[]
    applicantName: string
  }): Promise<{ orgId: string; propertyId: string; roomIds: string[] }> {
    const { draft } = input

    return this.db.transaction(async (tx) => {
      /* ------------------------------------------------------ the company */

      const [org] = await tx
        .insert(partnerOrgs)
        .values({
          name: draft.invoiceName?.trim() || draft.propertyName!.trim(),
          contactEmail: (await this.findUser(input.userId))?.email ?? "",
          country: draft.country ?? "",
          /*
           * Blank when the partner said "same as the property", which is what
           * `invoiceAddressSame` means — the property's own address is already
           * on the org through its property, and copying it would give two
           * places to change it and one of them wrong.
           */
          billingAddress: draft.invoiceAddressSame ? "" : (draft.invoiceAddress?.trim() ?? ""),
          status: "active",
        })
        .returning()

      await tx.insert(partnerMembers).values({
        orgId: org!.id,
        userId: input.userId,
        // The person who filled in thirty-one screens runs the account. Any
        // other role would lock them out of the thing they just created.
        role: "admin",
        status: "active",
        propertyIds: [],
      })

      // The account itself becomes a partner account. Without this the session
      // carries no membership and the extranet is closed to them.
      await tx.update(users).set({ role: "partner", platformRole: null }).where(eq(users.id, input.userId))

      /* ----------------------------------------------------- the property */

      const slug = await freeSlug(tx, slugify(draft.propertyName!))
      /*
       * Annotated with `NewProperty`, so `basePrice` cannot be named here.
       *
       * It used to be: set from the cheapest UNIT the applicant typed, while
       * the loop below created a non-refundable plan at a DISCOUNT off that
       * same number. The property went live advertising more than its own
       * cheapest bookable rate, and search — which filters on that column —
       * left it out of the band it belonged in. `decide` recomputes it once
       * the plans exist (rule #138).
       */
      const row: NewProperty = {
        slug,
        name: draft.propertyName!.trim(),
        city: draft.city ?? "",
        country: draft.country ?? "",
        address: [draft.street, draft.state, draft.zip].filter(Boolean).join(", "),
        type: draft.propertyType ?? "hotel",
        description: draft.description ?? "",
        checkInTime: draft.checkInFrom ?? "15:00",
        checkOutTime: draft.checkOutBy ?? "12:00",
        policyPets: (draft.houseRules ?? []).join("\n"),
        partnerOrgId: org!.id,
        /*
         * `active`, not `pending_review`.
         *
         * The platform has just read the whole registration — the property,
         * its rooms, its prices and the applicant's documents — and approved
         * it. Sending the same content round the listing queue would be
         * reviewing it twice, which only teaches whoever does it to skim.
         */
        status: "active",
        verification: "reviewed",
      }

      const [property] = await tx.insert(properties).values(row).returning()

      /* ----------------------------------------------------- the amenities */

      const slugs = draft.amenities ?? []
      if (slugs.length > 0) {
        /*
         * Only slugs the platform actually has (rule #74).
         *
         * A draft can be months old, and an amenity retired in between would
         * otherwise fail a foreign key in the middle of this transaction —
         * after the organisation had been created.
         */
        const known = await tx
          .select({ id: amenities.id })
          .from(amenities)
          .where(and(inArray(amenities.slug, slugs), eq(amenities.active, true)))

        if (known.length > 0) {
          await tx
            .insert(propertyAmenities)
            .values(known.map((row) => ({ propertyId: property!.id, amenityId: row.id })))
            .onConflictDoNothing()
        }
        if (known.length !== slugs.length) {
          this.logger.warn(
            `${slugs.length - known.length} amenity slug(s) on this registration no longer exist`
          )
        }
      }

      /* --------------------------------------------------- the photos */

      /*
       * The gallery the applicant uploaded, carried across as the listing's
       * own (rule #103).
       *
       * The storage KEY moves, not the bytes: a photo row points at an object,
       * and the object is already where it needs to be. Copying it would leave
       * two files for one picture and a second thing to delete.
       *
       * `status: "approved"` — not the "pending" a photo uploaded through the
       * extranet gets. These were part of the application the platform has just
       * read and approved (rule #73); sending them round the review queue again
       * would publish the listing with an empty gallery and ask somebody to
       * approve pictures that were approved a second ago.
       */
      const gallery = await tx
        .select({
          id: registrationDocuments.id,
          storageKey: registrationDocuments.storageKey,
          contentType: registrationDocuments.contentType,
        })
        .from(registrationDocuments)
        .where(
          and(
            eq(registrationDocuments.registrationId, input.registrationId),
            eq(registrationDocuments.kind, "photo")
          )
        )
        .orderBy(asc(registrationDocuments.createdAt))

      if (gallery.length > 0) {
        await tx.insert(photos).values(
          gallery.map((photo, position) => ({
            propertyId: property!.id,
            storageKey: photo.storageKey,
            contentType: photo.contentType,
            // The order they were uploaded in, which is the order the wizard
            // showed them back — so the cover is the one they saw first.
            position,
            status: "approved",
          }))
        )
      }

      /* -------------------------------------------------- rooms and rates */

      const policy = policyForPreset(draft.cancellationPolicy ?? "moderate")
      const paymentMode = paymentModeFor(draft.paymentMethod ?? "platform")
      const roomIds: string[] = []

      for (const unit of input.units) {
        const [room] = await tx
          .insert(rooms)
          .values({
            propertyId: property!.id,
            name: unit.name,
            description: unit.description,
            maxAdults: unit.maxAdults,
            maxChildren: unit.maxChildren,
            maxOccupancy: unit.maxOccupancy,
            bed: unit.bed,
            size: unit.size,
            features: unit.features,
            units: unit.units,
            status: "active",
          })
          .returning()
        roomIds.push(room!.id)

        await tx.insert(ratePlans).values({
          roomId: room!.id,
          name: "Flexible",
          basePrice: unit.price,
          cancelFreeUntil: policy.freeUntil,
          cancelCharge: policy.charge,
          cancelChargeValue: policy.chargeValue,
          paymentMode,
          isDefault: true,
          status: "active",
        })

        /*
         * The optional second plan the wizard offers: cheaper, non-refundable.
         *
         * A zero discount would be a non-refundable rate at the same price as
         * the flexible one — strictly worse for the guest and pointless for
         * the partner — so it is only created when there is a real saving.
         */
        if (unit.extraPlanDiscount && unit.extraPlanDiscount > 0) {
          await tx.insert(ratePlans).values({
            roomId: room!.id,
            name: "Non-refundable",
            basePrice: Math.round(unit.price * (1 - unit.extraPlanDiscount / 100)),
            cancelFreeUntil: "non_refundable",
            cancelCharge: "full",
            cancelChargeValue: null,
            paymentMode: "prepay",
            isDefault: false,
            status: "active",
          })
        }
      }

      /* --------------------------------------------------- the bank account */

      await tx.insert(partnerPayoutAccounts).values({
        partnerOrgId: org!.id,
        provider: "fake",
        providerAccountRef: `pending_${org!.id}`,
        holderName: draft.accountHolder!.trim(),
        /*
         * The last four digits, and nothing more of the number.
         *
         * The full IBAN is never written to this table — it is enough to
         * recognise the account on a screen and useless to anybody who reads
         * the row. `registration.service` scrubs it from the draft in the same
         * breath, so the complete number does not outlive the application.
         */
        last4: draft.iban!.trim().slice(-4),
        // Both were dropped on the floor: the partner typed a bank and a
        // currency at step 12 and the account was created with neither.
        bankName: draft.bankName?.trim() ?? "",
        currency: draft.payoutCurrency?.trim() || "USD",
        /*
         * `unverified`, always.
         *
         * A partner typing an IBAN into a form has not proved they own it, and
         * payouts to an unverified account are exactly how money leaves for the
         * wrong bank. Verification is the platform's own separate step.
         */
        status: "unverified",
      })

      /* ------------------------------------------------------ the agreement */

      const [template] = await tx
        .select()
        .from(contractTemplates)
        .where(and(eq(contractTemplates.kind, "service"), eq(contractTemplates.active, true)))
        .limit(1)

      if (template) {
        await tx.insert(partnerContracts).values({
          orgId: org!.id,
          templateId: template.id,
          kind: template.kind,
          version: template.version,
          title: template.title,
          // Copied, not referenced — a signature is a record of a moment.
          body: template.body,
          acceptedByUserId: input.userId,
          acceptedByName: input.applicantName,
        })
      } else {
        /*
         * No published agreement to accept.
         *
         * That is a platform configuration gap, not the partner's problem, so
         * it does not fail an approval they have waited on. It is logged loudly
         * because an organisation with no agreement on file is a real one.
         */
        this.logger.error(
          `No active service agreement published — org ${org!.id} has no contract on file`
        )
      }

      return { orgId: org!.id, propertyId: property!.id, roomIds }
    })
  }
}

/* ============================================================== internals == */

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "property"
  )
}

/**
 * A slug nobody else has.
 *
 * The loop is not the guard — the unique index is. Two approvals at the same
 * instant can both find `the-plaza` free; the second INSERT is what fails.
 */
async function freeSlug(tx: Database, base: string): Promise<string> {
  const taken = await tx.select({ slug: properties.slug }).from(properties)
  const used = new Set(taken.map((row) => row.slug))
  if (!used.has(base)) return base
  for (let n = 2; n < 1000; n += 1) {
    if (!used.has(`${base}-${n}`)) return `${base}-${n}`
  }
  return `${base}-${Date.now()}`
}
