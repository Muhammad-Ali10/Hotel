import { createHmac, randomUUID } from "node:crypto"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join, normalize, resolve, sep } from "node:path"

import { Injectable, Logger } from "@nestjs/common"

import { env } from "../../../config/env"
import type { PresignedUpload, StorageProvider } from "./storage.provider"

/**
 * Local disk, behind the same port (rule #73).
 *
 * The default everywhere but production, for the same reason the fake payment
 * and email providers are: a first local upload should not need a cloud
 * account, and the test suite must not need the network.
 *
 * It is a real implementation of the contract, not a stub — it hands out a URL
 * that must be used within a window, signs it so it cannot be forged, and
 * writes the bytes where `publicUrl` can find them. Code that works against
 * this works against S3, which is the only thing that makes the port worth
 * having.
 */
@Injectable()
export class FakeStorageProvider implements StorageProvider {
  private readonly logger = new Logger(FakeStorageProvider.name)
  private readonly root = resolve(process.cwd(), ".storage")

  presignUpload(input: {
    key: string
    contentType: string
    maxBytes: number
    expiresInSeconds: number
  }): Promise<PresignedUpload> {
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000)
    const signature = signKey(input.key, expiresAt.getTime())

    return Promise.resolve({
      // Points back at this API's own upload route — the only difference from
      // S3, where the browser writes straight to the bucket.
      url:
        `${env.STORAGE_PUBLIC_URL}/upload` +
        `?key=${encodeURIComponent(input.key)}` +
        `&expires=${expiresAt.getTime()}&signature=${signature}`,
      key: input.key,
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      expiresAt: expiresAt.toISOString(),
    })
  }

  publicUrl(key: string): string {
    return `${env.STORAGE_PUBLIC_URL}/${key}`
  }

  async remove(key: string): Promise<void> {
    try {
      // `force` so a second delete is as harmless as the first.
      await rm(this.pathFor(key), { force: true })
    } catch (error) {
      this.logger.warn(`Could not remove ${key}: ${(error as Error).message}`)
    }
  }

  /* ---------------------------------------------------------- fake only -- */

  /** Verifies a URL this provider issued. Never reachable in production. */
  verify(input: { key: string; expires: number; signature: string }): boolean {
    if (!Number.isFinite(input.expires) || input.expires < Date.now()) return false
    const expected = signKey(input.key, input.expires)
    // Constant-length compare — the values are hex of the same length.
    return expected.length === input.signature.length && expected === input.signature
  }

  async write(key: string, body: Buffer): Promise<void> {
    const path = this.pathFor(key)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, body)
  }

  /**
   * The on-disk path for a key, refusing anything that escapes the root.
   *
   * The key is built by this API and never taken from a request — but this is
   * the function that turns a string into a filesystem write, and a check here
   * costs nothing while an oversight here is arbitrary file write.
   */
  pathFor(key: string): string {
    const path = normalize(join(this.root, key))
    if (!path.startsWith(this.root + sep)) {
      throw new Error("Refusing a storage key that escapes the root")
    }
    return path
  }
}

/** A key nobody can guess, namespaced so a listing's files stay together. */
export function photoKey(propertyId: string, extension: string): string {
  return `properties/${propertyId}/${randomUUID()}.${extension}`
}

function signKey(key: string, expires: number): string {
  return createHmac("sha256", env.SESSION_SECRET).update(`${key}:${expires}`).digest("hex")
}
