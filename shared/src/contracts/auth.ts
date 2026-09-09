import { z } from "zod"

import { emailSchema } from "./common"

/* ============================================================================
 * Auth contracts (Module 1).
 * ========================================================================== */

/**
 * Password policy.
 *
 * Length is the only rule. Composition requirements ("one uppercase, one
 * symbol") push people towards `Password1!` — predictable, and weaker than a
 * long passphrase. OWASP has recommended length-over-composition for years.
 *
 * The MAXIMUM is a denial-of-service guard, not a security one: argon2id is
 * deliberately expensive, so hashing a megabyte-long password is a cheap way
 * to burn a CPU core.
 */
export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 128

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Passwords cannot be longer than ${PASSWORD_MAX} characters`)

const nameSchema = z.string().trim().min(1, "Required").max(80)

/**
 * `.strict()` on every input object.
 *
 * An unknown key is REJECTED rather than ignored — this is the mass-assignment
 * guard (API3). A body carrying `{"role":"admin"}` must fail loudly at the
 * edge, not get quietly dropped somewhere further in where the next refactor
 * might start trusting it.
 */
export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    firstName: nameSchema,
    lastName: nameSchema,
  })
  .strict()

export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "Enter your password"),
    /** Extends the session's idle window on a trusted device. */
    remember: z.boolean().default(false),
  })
  .strict()

export type LoginInput = z.infer<typeof loginSchema>

/**
 * What `/auth/me` returns — and, just as importantly, what it does NOT.
 *
 * `passwordHash` is absent by construction rather than by remembering to strip
 * it. Every response is built from a schema like this one, so a field can only
 * leak if somebody adds it here on purpose (API3, output side).
 */
export const sessionUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: z.enum(["customer", "partner", "admin"]),
  /**
   * The administrator's grade. `null` for everybody else.
   *
   * Carried on the session so the admin panel stops hardcoding `super_admin`
   * and reads what this account actually is — and so the two sides agree,
   * since the API enforces the same matrix.
   */
  platformRole: z.enum(["super_admin", "ops", "finance", "support"]).nullable(),
  firstName: z.string(),
  lastName: z.string(),
  tier: z.enum(["standard", "genius"]),
  emailVerified: z.boolean(),
  /** Present only for partner accounts. */
  partner: z
    .object({
      orgId: z.uuid(),
      orgName: z.string(),
      role: z.enum(["admin", "manager", "staff"]),
      /** Empty = every property the org owns. */
      propertyIds: z.array(z.uuid()),
    })
    .nullable(),
})

export type SessionUser = z.infer<typeof sessionUserSchema>

/**
 * The ONE failure message for both "no such account" and "wrong password".
 *
 * Distinguishing them tells an attacker which addresses are registered — the
 * enumeration hole in API2. The same string is used for signup collisions too,
 * for the same reason.
 */
export const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password"

/* ============================================================================
 * Profile, password and sessions (Module 1, the half that was missing).
 *
 * `docs/ARCHITECTURE.md` §5 API2 and API3 named all of this — `PATCH
 * /me/profile` by name, "password badalne par purani sab batil", "sab devices
 * se nikal do" — and none of it existed. The rules were written; the doors
 * were not.
 * ========================================================================== */

/**
 * What a guest may change about themselves.
 *
 * The omissions ARE the contract (API3). `role`, `tier`, `points`,
 * `membership`, `emailVerified`, `status` and `id` are all absent, and
 * `.strict()` means a body carrying one is rejected rather than quietly
 * stripped — so this cannot become a self-service route to a discount, an
 * admin badge, or somebody else's account.
 *
 * `email` is absent too, and deliberately: changing the address an account
 * signs in with is a security event that needs the old address notified and
 * the new one proven. That is its own flow, and it needs Module 9.
 */
export const profileUpdateSchema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    phone: z.string().trim().max(32),
    country: z.string().trim().max(80),
    city: z.string().trim().max(80),
    avatarSeed: z.string().trim().max(64),
    preferences: z.array(z.string().trim().max(40)).max(20),
  })
  .partial()
  .strict()

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>

/** The whole profile, as the dashboard reads it. */
export type ProfileView = {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string
  country: string
  city: string
  avatarSeed: string
  tier: "standard" | "genius"
  membership: string
  points: number
  preferences: string[]
  emailVerified: boolean
  joined: string
}

/* ------------------------------------------------------------- passwords -- */

export const changePasswordSchema = z
  .object({
    /**
     * Proof that the person at the keyboard is the account holder.
     *
     * A live session is not proof enough: an unlocked laptop is a live session,
     * and the whole value of a password change is that it locks everyone else
     * out.
     */
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
  })
  .strict()
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "Choose a password you have not used here before",
    path: ["newPassword"],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

/** Asking for a reset link. Always answered identically — see `RESET_SENT`. */
export const forgotPasswordSchema = z.object({ email: emailSchema }).strict()
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(20).max(200),
    newPassword: passwordSchema,
  })
  .strict()

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

/**
 * The ONE answer a reset request ever gets.
 *
 * Identical whether or not the address is registered — the same reasoning as
 * `INVALID_CREDENTIALS_MESSAGE`. A different reply for an unknown address
 * turns this endpoint into a way of asking "does this person have an account
 * here", which for a hotel booking site is a question worth not answering.
 */
export const RESET_SENT_MESSAGE =
  "If that address has an account, a reset link is on its way."

/* -------------------------------------------------------------- sessions -- */

/**
 * A signed-in device.
 *
 * No token and no hash of one: this list exists so a person can recognise
 * their own devices and throw out the ones they do not, and neither of those
 * needs the credential itself.
 */
export type SessionView = {
  id: string
  userAgent: string
  ip: string
  lastUsedAt: string
  createdAt: string
  expiresAt: string
  /** The device asking. Every list marks exactly one. */
  current: boolean
}

/**
 * The ONE answer signup ever gives (rule #58).
 *
 * Identical whether the address was known or not — the truth goes to the
 * mailbox, not to whoever typed the address into a form.
 */
export const SIGNUP_PENDING_MESSAGE =
  "Check your email to finish setting up your account."

export const verifyEmailSchema = z
  .object({ token: z.string().trim().min(20).max(200) })
  .strict()

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>
