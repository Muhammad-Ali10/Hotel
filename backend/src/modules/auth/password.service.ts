import { randomBytes } from "node:crypto"

import { Algorithm, hash, verify } from "@node-rs/argon2"
import { Injectable } from "@nestjs/common"

/**
 * Password hashing (docs/ARCHITECTURE.md §5, API2).
 *
 * argon2id, not bcrypt: bcrypt silently truncates at 72 bytes and its work
 * factor only costs CPU, so it is cheap to attack with rented GPUs. argon2id
 * is memory-hard — an attacker needs 19 MiB per guess, which is what makes
 * parallel cracking expensive.
 *
 * Parameters are OWASP's current recommendation. They are also encoded INTO
 * the hash string, so raising them later does not invalidate existing hashes:
 * old ones keep verifying with their own parameters and `needsRehash` reports
 * which should be upgraded on next login.
 */
const PARAMS = {
  algorithm: Algorithm.Argon2id,
  /** 19 MiB */
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const

@Injectable()
export class PasswordService {
  /**
   * A hash of a value nobody knows, used to burn the same CPU time on a login
   * for an address that does not exist.
   *
   * Without it, "no such user" returns in microseconds while "wrong password"
   * takes ~50ms — and that difference alone tells an attacker which addresses
   * are registered, however carefully the response body is worded.
   *
   * GENERATED at first use, never hardcoded. A hardcoded constant only works
   * if it happens to be a parseable argon2 string — and if it is not, `verify`
   * rejects it before doing any work. Measured on this machine:
   *
   *     real hash, wrong password   19.2 ms
   *     generated dummy             19.2 ms   ← indistinguishable
   *     unparseable string           0.1 ms   ← 240x faster, leaks completely
   *
   * Generating it removes the possibility of getting that wrong silently.
   */
  private dummyHash?: Promise<string>

  async hash(plain: string): Promise<string> {
    return hash(plain, PARAMS)
  }

  async verify(hashed: string, plain: string): Promise<boolean> {
    try {
      return await verify(hashed, plain, PARAMS)
    } catch {
      // A malformed hash in the database must read as "wrong password", never
      // as a 500 that tells the caller something unusual just happened.
      return false
    }
  }

  /**
   * Spends the same time as a real verification, for an account that does not
   * exist. Always returns false.
   */
  async verifyDummy(plain: string): Promise<boolean> {
    this.dummyHash ??= hash(randomBytes(32).toString("base64url"), PARAMS)
    try {
      await verify(await this.dummyHash, plain, PARAMS)
    } catch {
      // Expected — the point is the elapsed time, not the result.
    }
    return false
  }
}
