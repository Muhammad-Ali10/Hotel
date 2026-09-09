import { VersioningType } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import { desc, eq } from "drizzle-orm"
import request from "supertest"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { AppModule } from "../src/app.module"
import { basePriceDrift } from "./support/invariants"
import { resetDb } from "./support/reset-db"
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter"
import { applyBodyParsers } from "../src/common/http/body-parsers"
import { env } from "../src/config/env"
import { DRIZZLE, type Database } from "../src/db/drizzle.module"
import {
  amenities,
  contractTemplates,
  partnerContracts,
  partnerMembers,
  partnerOrgs,
  partnerPayoutAccounts,
  photos,
  properties,
  propertyAmenities,
  ratePlans,
  registrationDocuments,
  rooms,
  users,
} from "../src/db/schema"

const strong = "correct horse battery staple"

/** Everything `submissionGaps` asks for, so submit has nothing to complain about. */
const completeDraft = {
  propertyName: "The Plaza",
  propertyType: "villa" as const,
  street: "768 5th Ave",
  city: "New York",
  state: "NY",
  zip: "10019",
  country: "USA",
  description: "A landmark on the corner of Central Park, with rooms overlooking the water. ".repeat(
    3
  ),
  amenities: ["wifi", "pool"],
  checkInFrom: "15:00",
  checkOutBy: "11:00",
  cancellationPolicy: "moderate" as const,
  houseRules: ["No parties", "No smoking indoors"],
  payoutCurrency: "USD",
  accountHolder: "Plaza Hospitality LLC",
  bankName: "First National",
  iban: "GB33BUKB20201555556789",
  swift: "BUKBGB22",
  units: [
    {
      unitType: "Suite",
      unitCount: 4,
      beds: { king: 1, twin: 2 },
      guests: 3,
      size: "48 m2",
      amenities: ["balcony"],
      name: "Park View Suite",
      price: 92_000,
      ratePlan: { enabled: true, discount: 15 },
    },
  ],
  paymentMethod: "property" as const,
  invoiceNameType: "company" as const,
  invoiceName: "Plaza Hospitality LLC",
  agreedToTerms: true,
}

describe("registration wizard (Module 12)", () => {
  let app: NestExpressApplication
  let db: Database

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false })
    app.setGlobalPrefix("api")
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" })
    app.set("trust proxy", 1)
    app.use(cookieParser(env.SESSION_SECRET))
    applyBodyParsers(app)
    app.useGlobalFilters(new AllExceptionsFilter())
    await app.init()
    await app.listen(0)
    db = moduleRef.get<Database>(DRIZZLE)
  })

  afterAll(async () => {
    await resetDb(db)
    await app?.close()
  })

  beforeEach(() => resetDb(db))

  const server = () => app.getHttpServer()
  let n = 0
  const freshIp = () => `192.0.2.${++n % 250}`

  async function account(email = `applicant${++n}@example.test`) {
    await request(server())
      .post("/api/v1/auth/signup")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong, firstName: "Dana", lastName: "Okafor" })
      .expect(201)
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email, password: strong })
      .expect(200)
    return {
      cookie: res.headers["set-cookie"] as unknown as string[],
      id: res.body.user.id as string,
      email,
    }
  }

  async function admin() {
    const g = await account(`root${++n}@stayora.test`)
    await db.update(users).set({ role: "admin", platformRole: "super_admin" }).where(eq(users.id, g.id))
    const res = await request(server())
      .post("/api/v1/auth/login")
      .set("x-forwarded-for", freshIp())
      .send({ email: g.email, password: strong })
      .expect(200)
    return res.headers["set-cookie"] as unknown as string[]
  }

  /**
   * Everything submit needs that is NOT in the draft.
   *
   * Two of the gaps live outside the document: an unconfirmed email address,
   * and a listing with no photographs. Both are deliberately not part of
   * `submissionGaps` — that function is pure over the draft, which is what lets
   * the frontend share it — so a test that wants a submittable application has
   * to satisfy them the way a real applicant would.
   *
   * Written straight to the tables rather than through the routes: the
   * verification token only exists inside an email, and the photo upload PUTs
   * bytes at storage. Neither is what these tests are about.
   */
  async function readyToSubmit(applicant: { id: string; cookie: string[] }) {
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date().toISOString() })
      .where(eq(users.id, applicant.id))

    const draft = await mine(applicant.cookie).expect(200)
    await db.insert(registrationDocuments).values({
      registrationId: draft.body.id as string,
      kind: "photo",
      fileName: "front.jpg",
      contentType: "image/jpeg",
      storageKey: `registrations/${draft.body.id}/front.jpg`,
    })
    return draft.body.id as string
  }

  async function seedAmenities() {
    await db
      .insert(amenities)
      .values([
        { slug: "wifi", label: "WiFi", category: "internet", position: 1 },
        { slug: "pool", label: "Pool", category: "wellness", position: 2 },
      ])
      .onConflictDoNothing()
  }

  async function seedAgreement() {
    const [template] = await db
      .insert(contractTemplates)
      .values({
        kind: "service",
        version: 1,
        title: "Master Service Agreement",
        body: "Stayora charges commission on completed bookings.",
        effectiveFrom: "2026-01-01",
      })
      .returning()
    return template!
  }

  const mine = (cookie: string[]) =>
    request(server()).get("/api/v1/join/registration").set("Cookie", cookie)

  const patch = (cookie: string[], body: object) =>
    request(server()).patch("/api/v1/join/registration").set("Cookie", cookie).send(body)

  const submit = (cookie: string[]) =>
    request(server()).post("/api/v1/join/registration/submit").set("Cookie", cookie)

  const decide = (cookie: string[], id: string, body: object) =>
    request(server())
      .post(`/api/v1/admin/registrations/${id}/decision`)
      .set("Cookie", cookie)
      .send(body)

  /* ============================================================== the draft == */

  it("creates a draft on first read, and remembers where they got to", async () => {
    const applicant = await account()

    const first = await mine(applicant.cookie).expect(200)
    expect(first.body).toMatchObject({ status: "in_progress", currentStep: 5 })
    expect(first.body.gaps.length).toBeGreaterThan(0)

    await patch(applicant.cookie, {
      step: 7,
      data: { propertyName: "The Plaza", city: "New York" },
    }).expect(200)

    // The one thing a server-side wizard is for: closing the tab and coming
    // back to the same screen rather than to the start.
    const resumed = await mine(applicant.cookie).expect(200)
    expect(resumed.body.currentStep).toBe(7)
    expect(resumed.body.data).toMatchObject({ propertyName: "The Plaza", city: "New York" })
  })

  it("merges screens instead of overwriting the document", async () => {
    const applicant = await account()

    await patch(applicant.cookie, { step: 6, data: { propertyName: "The Plaza" } }).expect(200)
    await patch(applicant.cookie, { step: 7, data: { city: "New York" } }).expect(200)

    /*
     * Merged in the DATABASE, not read-modify-write here. Two screens saved at
     * once would otherwise each write the whole document from their own stale
     * copy, and the later one would erase the earlier one's answers.
     */
    const res = await mine(applicant.cookie).expect(200)
    expect(res.body.data).toMatchObject({ propertyName: "The Plaza", city: "New York" })
  })

  it("never moves the resume point backwards", async () => {
    const applicant = await account()
    await patch(applicant.cookie, { step: 20, data: {} }).expect(200)

    // Going back to review an earlier screen must not throw away how far they
    // actually got.
    await patch(applicant.cookie, { step: 6, data: { city: "Paris" } }).expect(200)

    const res = await mine(applicant.cookie).expect(200)
    expect(res.body.currentStep).toBe(20)
    expect(res.body.data.city).toBe("Paris")
  })

  it("keeps one registration per person, even across two tabs", async () => {
    const applicant = await account()
    await Promise.all([mine(applicant.cookie).expect(200), mine(applicant.cookie).expect(200)])

    const rows = await db.select().from(users)
    expect(rows.length).toBeGreaterThan(0)
    const first = await mine(applicant.cookie).expect(200)
    const second = await mine(applicant.cookie).expect(200)
    expect(second.body.id).toBe(first.body.id)
  })

  it("refuses a field the wizard has no business sending (API3)", async () => {
    const applicant = await account()
    await patch(applicant.cookie, { data: { status: "approved" } }).expect(400)
    await patch(applicant.cookie, { data: { propertyType: "spaceship" } }).expect(400)
  })

  it("needs a session", async () => {
    await request(server()).get("/api/v1/join/registration").expect(401)
  })

  /* ================================================================ submit == */

  it("lists EVERY gap at once, not one at a time", async () => {
    const applicant = await account()
    await patch(applicant.cookie, { data: { propertyName: "The Plaza" } }).expect(200)

    const res = await submit(applicant.cookie).expect(400)

    /*
     * Thirty-one screens told one missing thing at a time is a form that lies
     * about how much is left.
     */
    expect(res.body.gaps.length).toBeGreaterThan(4)
    expect(res.body.gaps).toContain("Choose a cancellation policy")
    expect(res.body.gaps).not.toContain("Name the property")
  })

  it("names the room that is unfinished", async () => {
    const applicant = await account()
    await patch(applicant.cookie, {
      data: {
        ...completeDraft,
        units: [
          { name: "Park View Suite", price: 92_000, guests: 2 },
          { name: "Garden Room", guests: 2 },
        ],
      },
    }).expect(200)

    const res = await submit(applicant.cookie).expect(400)
    /*
     * The draft's own gap, named. The other two come from outside the document
     * — no photograph, and an address nobody has confirmed — and are reported
     * in the same list, because a partner does not care which side of that
     * line a missing thing falls on.
     */
    expect(res.body.gaps).toContain("Set a nightly price for Garden Room")
    expect(res.body.gaps).toContain("Add at least one photo of the property")
    expect(res.body.gaps).toContain("Confirm your email address")
  })

  it("locks the draft once it is with the platform", async () => {
    await seedAmenities()
    const applicant = await account()
    await patch(applicant.cookie, { data: completeDraft }).expect(200)
    await readyToSubmit(applicant)
    await submit(applicant.cookie).expect(201)

    // A draft still editable during review means the thing being approved is
    // not the thing that was read.
    await patch(applicant.cookie, { data: { propertyName: "Something Else" } }).expect(409)
    await submit(applicant.cookie).expect(409)
  })

  /* =============================================================== approval == */

  it("turns the draft into a real business, in one transaction", async () => {
    await seedAmenities()
    await seedAgreement()
    const applicant = await account()
    await patch(applicant.cookie, { data: completeDraft }).expect(200)
    await readyToSubmit(applicant)
    const submitted = await submit(applicant.cookie).expect(201)

    const root = await admin()
    const approved = await decide(root, submitted.body.id, { decision: "approve" }).expect(201)

    expect(approved.body).toMatchObject({ status: "approved" })
    expect(approved.body.orgId).toBeTruthy()
    expect(approved.body.propertyId).toBeTruthy()

    /* --------------------------------------------------------- the company */
    const [org] = await db
      .select()
      .from(partnerOrgs)
      .where(eq(partnerOrgs.id, approved.body.orgId))
    expect(org).toMatchObject({ name: "Plaza Hospitality LLC", status: "active" })

    const [member] = await db
      .select()
      .from(partnerMembers)
      .where(eq(partnerMembers.userId, applicant.id))
    // The person who filled in thirty-one screens runs the account.
    expect(member).toMatchObject({ role: "admin", status: "active" })

    const [person] = await db.select().from(users).where(eq(users.id, applicant.id))
    // Without this the session carries no membership and the extranet is shut.
    expect(person!.role).toBe("partner")

    /* -------------------------------------------------------- the property */
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, approved.body.propertyId))
    expect(property).toMatchObject({
      name: "The Plaza",
      city: "New York",
      // The type the database refused before this work: the wizard has always
      // offered eight, the CHECK accepted two.
      type: "villa",
      status: "active",
      checkInTime: "15:00",
      checkOutTime: "11:00",
    })
    /*
     * `from $X` on a card means the cheapest thing a guest can BOOK, not the
     * cheapest room. This draft's room is $920 with a non-refundable plan 15%
     * under it, so the answer is $782.
     *
     * It asserted 92_000 until approval stopped setting this column by hand —
     * which meant a new listing advertised more than its own cheapest rate and
     * was filtered out of the price band it belonged in.
     */
    expect(property!.basePrice).toBe(78_200)

    const linkedAmenities = await db
      .select()
      .from(propertyAmenities)
      .where(eq(propertyAmenities.propertyId, property!.id))
    expect(linkedAmenities).toHaveLength(2)

    /* ------------------------------------------------------------- rooms */
    const roomRows = await db.select().from(rooms).where(eq(rooms.propertyId, property!.id))
    expect(roomRows).toHaveLength(1)
    expect(roomRows[0]).toMatchObject({
      name: "Park View Suite",
      units: 4,
      maxAdults: 3,
      // NOT zero. The wizard asks one question — "how many guests" — and zero
      // would mean "cannot accommodate children", a restriction the partner
      // never chose and would discover when a family failed to book.
      maxChildren: 3,
      size: 48,
    })
    expect(roomRows[0]!.bed).toBe("1 king bed, 2 twin beds")
    // Four beds sleep more than the three they typed, so the total follows the
    // beds rather than telling them they were wrong about their own room.
    expect(roomRows[0]!.maxOccupancy).toBe(4)

    /* --------------------------------------------------------- rate plans */
    const plans = await db.select().from(ratePlans).where(eq(ratePlans.roomId, roomRows[0]!.id))
    expect(plans).toHaveLength(2)

    const flexible = plans.find((p) => p.isDefault)!
    expect(flexible).toMatchObject({
      name: "Flexible",
      basePrice: 92_000,
      // "Moderate" is not a column anywhere — it expands to a structured
      // policy (rule #102), so the guest sentence can be generated.
      cancelFreeUntil: "48h",
      cancelCharge: "first_night",
      // The wizard's "property" means the desk takes the money (rule #42).
      paymentMode: "guarantee",
    })

    const nonRefundable = plans.find((p) => !p.isDefault)!
    expect(nonRefundable).toMatchObject({
      name: "Non-refundable",
      basePrice: 78_200,
      cancelFreeUntil: "non_refundable",
      paymentMode: "prepay",
    })

    /* ------------------------------------------------------ the bank account */
    const [payout] = await db
      .select()
      .from(partnerPayoutAccounts)
      .where(eq(partnerPayoutAccounts.partnerOrgId, org!.id))
    // Typing an IBAN into a form is not proof of owning it. Payouts to an
    // unverified account are how money leaves for the wrong bank.
    expect(payout).toMatchObject({ status: "unverified", last4: "6789" })

    /* -------------------------------------------------------- the agreement */
    const [contract] = await db
      .select()
      .from(partnerContracts)
      .where(eq(partnerContracts.orgId, org!.id))
    expect(contract).toMatchObject({ kind: "service", version: 1, status: "accepted" })
    expect(contract!.body).toContain("commission on completed bookings")
  })

  it("puts the new property into the public catalogue immediately", async () => {
    await seedAmenities()
    const applicant = await account()
    await patch(applicant.cookie, { data: completeDraft }).expect(200)
    await readyToSubmit(applicant)
    const submitted = await submit(applicant.cookie).expect(201)

    const root = await admin()
    await decide(root, submitted.body.id, { decision: "approve" }).expect(201)

    // The platform has just read the whole thing. Sending it round the listing
    // queue as well would be reviewing the same content twice.
    const search = await request(server()).get("/api/v1/properties").expect(200)
    expect(search.body.items.map((i: { name: string }) => i.name)).toContain("The Plaza")
  })

  it("survives an amenity the platform retired between drafting and approval", async () => {
    await seedAmenities()
    const applicant = await account()
    await patch(applicant.cookie, {
      data: { ...completeDraft, amenities: ["wifi", "helipad"] },
    }).expect(200)
    await readyToSubmit(applicant)
    const submitted = await submit(applicant.cookie).expect(201)

    const root = await admin()
    // A draft can be months old. An unknown slug must not fail a foreign key
    // halfway through — after the organisation has already been created.
    const approved = await decide(root, submitted.body.id, { decision: "approve" }).expect(201)

    const linked = await db
      .select()
      .from(propertyAmenities)
      .where(eq(propertyAmenities.propertyId, approved.body.propertyId))
    expect(linked).toHaveLength(1)
  })

  it("creates nothing at all when it is rejected", async () => {
    await seedAmenities()
    const applicant = await account()
    await patch(applicant.cookie, { data: completeDraft }).expect(200)
    await readyToSubmit(applicant)
    const submitted = await submit(applicant.cookie).expect(201)

    const root = await admin()
    const rejected = await decide(root, submitted.body.id, {
      decision: "reject",
      note: "The ownership document does not match the address on the listing.",
    }).expect(201)

    expect(rejected.body.status).toBe("rejected")
    expect(await db.select().from(partnerOrgs)).toHaveLength(0)
    expect(await db.select().from(properties)).toHaveLength(0)

    const [person] = await db.select().from(users).where(eq(users.id, applicant.id))
    expect(person!.role).toBe("customer")
  })

  it("refuses a rejection with no reason behind it", async () => {
    await seedAmenities()
    const applicant = await account()
    await patch(applicant.cookie, { data: completeDraft }).expect(200)
    await readyToSubmit(applicant)
    const submitted = await submit(applicant.cookie).expect(201)

    const root = await admin()
    await decide(root, submitted.body.id, { decision: "reject" }).expect(400)
    await decide(root, submitted.body.id, { decision: "reject", note: "" }).expect(400)
  })

  it("decides once, and says so the second time", async () => {
    await seedAmenities()
    const applicant = await account()
    await patch(applicant.cookie, { data: completeDraft }).expect(200)
    await readyToSubmit(applicant)
    const submitted = await submit(applicant.cookie).expect(201)

    const root = await admin()
    await decide(root, submitted.body.id, { decision: "approve" }).expect(201)
    // A second approval would create a second organisation for the same person.
    await decide(root, submitted.body.id, { decision: "approve" }).expect(409)

    expect(await db.select().from(partnerOrgs)).toHaveLength(1)
  })

  /* --------------------------------------------- what approval carries over */

  it("gives the new property the photos the applicant uploaded", async () => {
    await seedAmenities()
    await seedAgreement()
    const applicant = await account()
    await patch(applicant.cookie, { data: completeDraft }).expect(200)
    const registrationId = await readyToSubmit(applicant)

    /* A second one, so order matters and can be checked. */
    await db.insert(registrationDocuments).values({
      registrationId,
      kind: "photo",
      fileName: "suite.jpg",
      contentType: "image/jpeg",
      storageKey: `registrations/${registrationId}/suite.jpg`,
    })

    const submitted = await submit(applicant.cookie).expect(201)
    const root = await admin()
    await decide(root, submitted.body.id, { decision: "approve" }).expect(201)

    const gallery = await db.select().from(photos)
    expect(gallery).toHaveLength(2)

    /*
     * `approved`, not the `pending` an extranet upload gets (rule #73). The
     * platform has just read and approved this application; sending its own
     * photographs back round the review queue would publish the listing with
     * an empty gallery.
     */
    expect(gallery.every((photo) => photo.status === "approved")).toBe(true)

    // Upload order, so the cover is the one the wizard showed first.
    const byPosition = [...gallery].sort((a, b) => a.position - b.position)
    expect(byPosition.map((photo) => photo.storageKey)).toEqual([
      `registrations/${registrationId}/front.jpg`,
      `registrations/${registrationId}/suite.jpg`,
    ])
  })

  it("advertises the cheapest rate a guest can actually book", async () => {
    await seedAmenities()
    await seedAgreement()
    const applicant = await account()

    /*
     * A room at $920 with a non-refundable plan 15% below it. The cheapest
     * BOOKABLE night is the discounted one, and that is what a card saying
     * "from" has to show.
     */
    await patch(applicant.cookie, {
      data: {
        ...completeDraft,
        units: [{ ...completeDraft.units[0], price: 92_000, ratePlan: { enabled: true, discount: 15 } }],
      },
    }).expect(200)
    await readyToSubmit(applicant)
    const submitted = await submit(applicant.cookie).expect(201)

    const root = await admin()
    await decide(root, submitted.body.id, { decision: "approve" }).expect(201)

    const [property] = await db.select().from(properties).orderBy(desc(properties.createdAt)).limit(1)
    const plans = await db.select().from(ratePlans)
    const cheapestPlan = Math.min(...plans.map((p) => p.basePrice))

    /*
     * It used to be set by hand from the unit price, ignoring the discounted
     * plan the same transaction created — so the listing went live advertising
     * more than its own cheapest rate. Search filters on this column, so the
     * property was missing from the price band it actually belonged in.
     */
    expect(cheapestPlan).toBe(78_200)
    expect(property!.basePrice).toBe(cheapestPlan)

    // The same invariant the whole-table scan uses, so the two cannot drift
    // apart into two different ideas of what this column means.
    expect(await basePriceDrift(db)).toEqual([])
  })

  it("keeps only the last four digits of the bank account, and forgets the rest", async () => {
    await seedAmenities()
    await seedAgreement()
    const applicant = await account()
    await patch(applicant.cookie, { data: completeDraft }).expect(200)
    await readyToSubmit(applicant)
    const submitted = await submit(applicant.cookie).expect(201)

    const root = await admin()
    await decide(root, submitted.body.id, { decision: "approve" }).expect(201)

    const [payout] = await db.select().from(partnerPayoutAccounts)
    expect(payout!.last4).toBe("6789")
    expect(payout!.bankName).toBe("First National")
    expect(payout!.currency).toBe("USD")

    /*
     * The full IBAN does not outlive the application.
     *
     * It lived in this JSON column indefinitely, readable by every
     * administrator with the queue open, while the account it became keeps
     * four digits on purpose.
     */
    const after = await mine(applicant.cookie).expect(200)
    expect(after.body.data.iban).toBe("")
    expect(after.body.data.swift).toBe("")
    expect(after.body.data.accountHolder).toBe("Plaza Hospitality LLC")
  })

  it("puts the bathroom and smoking answers on the room", async () => {
    await seedAmenities()
    await seedAgreement()
    const applicant = await account()
    await patch(applicant.cookie, {
      data: {
        ...completeDraft,
        units: [
          {
            ...completeDraft.units[0],
            bathroomPrivate: true,
            bathroomItems: ["Bathtub", "Free toiletries"],
            smoking: false,
          },
        ],
      },
    }).expect(200)
    await readyToSubmit(applicant)
    const submitted = await submit(applicant.cookie).expect(201)

    const root = await admin()
    await decide(root, submitted.body.id, { decision: "approve" }).expect(201)

    const [room] = await db.select().from(rooms)
    /*
     * Three screens' worth of answers that used to stop at the draft. The
     * bathroom screen would not let a partner continue without saying private
     * or shared, and then told the listing neither.
     */
    expect(room!.features).toContain("Private bathroom")
    expect(room!.features).toContain("Bathtub")
    expect(room!.features).toContain("balcony")
    expect(room!.features).toContain("Non-smoking")
  })

  it("addresses the invoice where the partner asked, or to the property", async () => {
    await seedAmenities()
    await seedAgreement()
    const applicant = await account()
    await patch(applicant.cookie, {
      data: {
        ...completeDraft,
        invoiceAddressSame: false,
        invoiceAddress: "Finance, 14 Rue de la Paix, 75002 Paris",
      },
    }).expect(200)
    await readyToSubmit(applicant)
    const submitted = await submit(applicant.cookie).expect(201)

    const root = await admin()
    await decide(root, submitted.body.id, { decision: "approve" }).expect(201)

    const [org] = await db.select().from(partnerOrgs)
    expect(org!.billingAddress).toBe("Finance, 14 Rue de la Paix, 75002 Paris")
    // The invoice name is the organisation's legal name (step 22).
    expect(org!.name).toBe("Plaza Hospitality LLC")
  })

  it("refuses a photograph that is not an image, and a document that is", async () => {
    const applicant = await account()
    await mine(applicant.cookie).expect(200)

    const upload = (body: object) =>
      request(server())
        .post("/api/v1/join/registration/documents/upload-url")
        .set("Cookie", applicant.cookie)
        .send(body)

    /* A deed of ownership is a fine PDF and is not a photograph of a bedroom. */
    await upload({
      kind: "photo",
      fileName: "deed.pdf",
      contentType: "application/pdf",
      size: 1000,
    }).expect(400)

    await upload({
      kind: "ownership",
      fileName: "deed.pdf",
      contentType: "application/pdf",
      size: 1000,
    }).expect(201)

    await upload({
      kind: "photo",
      fileName: "front.jpg",
      contentType: "image/jpeg",
      size: 1000,
    }).expect(201)
  })

  it("will not decide something nobody has submitted", async () => {
    const applicant = await account()
    await mine(applicant.cookie).expect(200)
    const root = await admin()

    const queue = await request(server())
      .get("/api/v1/admin/registrations")
      .set("Cookie", root)
      .expect(200)

    await decide(root, queue.body.items[0].id, { decision: "approve" }).expect(409)
  })

  /* ================================================================ queue == */

  it("shows the platform who applied and what for", async () => {
    await seedAmenities()
    const applicant = await account("dana@example.test")
    await patch(applicant.cookie, { data: completeDraft }).expect(200)
    await readyToSubmit(applicant)
    await submit(applicant.cookie).expect(201)

    const root = await admin()
    const res = await request(server())
      .get("/api/v1/admin/registrations")
      .set("Cookie", root)
      .query({ status: "submitted" })
      .expect(200)

    expect(res.body.items).toHaveLength(1)
    expect(res.body.items[0]).toMatchObject({
      status: "submitted",
      propertyName: "The Plaza",
      city: "New York",
      applicantEmail: "dana@example.test",
      applicantName: "Dana Okafor",
    })
  })

  it("searches by applicant and by property name", async () => {
    const applicant = await account("dana@example.test")
    await patch(applicant.cookie, { data: { propertyName: "The Plaza" } }).expect(200)
    const root = await admin()

    const byProperty = await request(server())
      .get("/api/v1/admin/registrations")
      .set("Cookie", root)
      .query({ q: "plaza" })
      .expect(200)
    expect(byProperty.body.items).toHaveLength(1)

    const byEmail = await request(server())
      .get("/api/v1/admin/registrations")
      .set("Cookie", root)
      .query({ q: "dana@" })
      .expect(200)
    expect(byEmail.body.items).toHaveLength(1)

    const nothing = await request(server())
      .get("/api/v1/admin/registrations")
      .set("Cookie", root)
      .query({ q: "%" })
      .expect(200)
    // Unescaped, a wildcard would match every registration there is.
    expect(nothing.body.items).toHaveLength(0)
  })

  it("is closed to applicants", async () => {
    const applicant = await account()
    await request(server())
      .get("/api/v1/admin/registrations")
      .set("Cookie", applicant.cookie)
      .expect(403)
  })

  /* ============================================================ documents == */

  it("hands out a presigned URL and refuses the wrong kind of file", async () => {
    const applicant = await account()

    const ok = await request(server())
      .post("/api/v1/join/registration/documents/upload-url")
      .set("Cookie", applicant.cookie)
      .send({
        kind: "identity",
        fileName: "passport.pdf",
        contentType: "application/pdf",
        size: 500_000,
      })
      .expect(201)
    expect(ok.body.url).toBeTruthy()
    expect(ok.body.key).toContain("registrations/")
    // The partner's file name never reaches the key: it is attacker-controlled
    // text going into a path.
    expect(ok.body.key).not.toContain("passport")

    await request(server())
      .post("/api/v1/join/registration/documents/upload-url")
      .set("Cookie", applicant.cookie)
      .send({
        kind: "identity",
        fileName: "virus.exe",
        contentType: "application/x-msdownload",
        size: 1_000,
      })
      .expect(400)

    await request(server())
      .post("/api/v1/join/registration/documents/upload-url")
      .set("Cookie", applicant.cookie)
      .send({
        kind: "identity",
        fileName: "scan.pdf",
        contentType: "application/pdf",
        size: 40 * 1024 * 1024,
      })
      .expect(400)
  })

  it("will not let a partner claim an upload that is not theirs", async () => {
    const applicant = await account()
    const other = await account()
    const theirs = await request(server())
      .post("/api/v1/join/registration/documents/upload-url")
      .set("Cookie", other.cookie)
      .send({
        kind: "identity",
        fileName: "passport.pdf",
        contentType: "application/pdf",
        size: 1_000,
      })
      .expect(201)

    await request(server())
      .post("/api/v1/join/registration/documents")
      .set("Cookie", applicant.cookie)
      .send({
        kind: "identity",
        fileName: "passport.pdf",
        contentType: "application/pdf",
        size: 1_000,
        key: theirs.body.key,
      })
      .expect(400)
  })

  it("records a document, and lets the platform review it", async () => {
    const applicant = await account()
    const signed = await request(server())
      .post("/api/v1/join/registration/documents/upload-url")
      .set("Cookie", applicant.cookie)
      .send({
        kind: "ownership",
        fileName: "deed.pdf",
        contentType: "application/pdf",
        size: 1_000,
      })
      .expect(201)

    const doc = await request(server())
      .post("/api/v1/join/registration/documents")
      .set("Cookie", applicant.cookie)
      .send({
        kind: "ownership",
        fileName: "deed.pdf",
        contentType: "application/pdf",
        size: 1_000,
        key: signed.body.key,
      })
      .expect(201)
    expect(doc.body).toMatchObject({ kind: "ownership", status: "pending" })

    const root = await admin()
    const reviewed = await request(server())
      .post(`/api/v1/admin/registrations/documents/${doc.body.id}/review`)
      .set("Cookie", root)
      .send({ status: "approved", note: "Matches the address on the listing." })
      .expect(201)
    expect(reviewed.body).toMatchObject({ status: "approved" })
    expect(reviewed.body.reviewedAt).toBeTruthy()
  })

  /* ================================================================ audit == */

  it("records the verdict, and what it created", async () => {
    await seedAmenities()
    const applicant = await account()
    await patch(applicant.cookie, { data: completeDraft }).expect(200)
    await readyToSubmit(applicant)
    const submitted = await submit(applicant.cookie).expect(201)

    const root = await admin()
    const approved = await decide(root, submitted.body.id, { decision: "approve" }).expect(201)

    const log = await request(server())
      .get("/api/v1/admin/audit")
      .set("Cookie", root)
      .expect(200)

    const entry = log.body.items.find(
      (e: { action: string }) => e.action === "registration.approve"
    )
    expect(entry).toBeTruthy()
    // Approving creates a business. "Who let this organisation in" has to have
    // an answer (rule #77).
    expect(entry.metadata).toMatchObject({ orgId: approved.body.orgId })
  })
})
