/* ============================================================================
 * The storage port (rule #73).
 *
 * The fourth thing behind a port, after payments, payouts and email, and for
 * the same reason: the product needs "put a file somewhere and give me a URL",
 * not "talk to S3". R2, S3 and MinIO all speak the same protocol and a hotel
 * marketplace has no opinion about which one is on the other end.
 *
 * The shape of this interface encodes the security decision, not just the
 * plumbing: there is **no `upload(bytes)` method**. The API never receives a
 * file. It hands out a URL the browser writes to directly, locked to a size
 * and a content type it chose. That is what keeps a partner from posting a
 * 200MB executable through an endpoint that believed it was an image, and what
 * keeps the whole SSRF class out — nothing here ever fetches a URL a partner
 * supplied (API7).
 * ========================================================================== */

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER")

export type PresignedUpload = {
  /** Where the browser PUTs the bytes. Short-lived. */
  url: string
  /**
   * The verb that was signed.
   *
   * Stated rather than assumed. The frontend uploader read a `method` off this
   * response and got `undefined`, which `fetch` treats as GET — so every photo
   * upload in the extranet asked storage to READ a key that did not exist yet,
   * and no photograph a partner chose was ever stored. A signature covers a
   * verb; the verb belongs in the answer.
   */
  method: "PUT"
  /** The object key to record once the upload succeeds. */
  key: string
  /**
   * Headers the browser MUST send, because they are part of what was signed.
   *
   * `Content-Type` is in here deliberately: signing it means storage itself
   * rejects a file whose type does not match what was declared, so the check
   * does not depend on this API being asked politely.
   */
  headers: Record<string, string>
  expiresAt: string
}

export interface StorageProvider {
  /**
   * A URL the browser can PUT one file to, once, soon.
   *
   * `maxBytes` is signed into the request where the provider supports it, so
   * an oversized upload fails at storage rather than after the fact — by which
   * point the bytes have already been paid for.
   */
  presignUpload(input: {
    key: string
    contentType: string
    maxBytes: number
    expiresInSeconds: number
  }): Promise<PresignedUpload>

  /** What a browser fetches to see the object. */
  publicUrl(key: string): string

  /**
   * Removes an object.
   *
   * Must not throw when the key is already gone: a delete that runs twice —
   * a retry, a partner double-clicking — should be as harmless as one that
   * runs once.
   */
  remove(key: string): Promise<void>
}
