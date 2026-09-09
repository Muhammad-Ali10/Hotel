import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { Injectable, Logger } from "@nestjs/common"

import { env } from "../../../config/env"
import type { PresignedUpload, StorageProvider } from "./storage.provider"

/**
 * S3-COMPATIBLE storage — R2, S3, MinIO, whichever (rule #73).
 *
 * `forcePathStyle` because that is what everything except AWS itself wants:
 * R2 and MinIO address buckets as `endpoint/bucket/key`, while AWS prefers
 * `bucket.endpoint/key`. Path style works on all of them, so it is the setting
 * that makes "S3-compatible" actually mean compatible.
 *
 * The credentials are only ever used to SIGN. The bytes go from the browser
 * straight to the bucket and never touch this process — which is the point of
 * presigning, and the reason a photo upload cannot become a way to make this
 * server fetch or store anything a partner chooses (API7).
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly logger = new Logger(S3StorageProvider.name)
  private readonly client: S3Client

  constructor() {
    this.client = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      forcePathStyle: true,
      credentials: {
        // The env schema refuses to boot with `STORAGE_DRIVER=s3` and these
        // missing, so this class never runs without them.
        accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY!,
      },
    })
  }

  async presignUpload(input: {
    key: string
    contentType: string
    maxBytes: number
    expiresInSeconds: number
  }): Promise<PresignedUpload> {
    const command = new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: input.key,
      ContentType: input.contentType,
      /*
       * Signed into the request, so storage enforces it rather than trusting
       * this API to have checked. A client that presents a different length
       * gets rejected by the bucket, which is the only place the check cannot
       * be talked out of.
       */
      ContentLength: input.maxBytes,
    })

    const url = await getSignedUrl(this.client, command, {
      expiresIn: input.expiresInSeconds,
    })

    return {
      url,
      key: input.key,
      method: "PUT",
      // Both are part of what was signed; a browser that omits either gets a
      // signature mismatch from the bucket.
      headers: {
        "Content-Type": input.contentType,
        "Content-Length": String(input.maxBytes),
      },
      expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000).toISOString(),
    }
  }

  publicUrl(key: string): string {
    // The CDN in front of the bucket, not the bucket — see `STORAGE_PUBLIC_URL`.
    return `${env.STORAGE_PUBLIC_URL.replace(/\/$/, "")}/${key}`
  }

  async remove(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key })
      )
    } catch (error) {
      /*
       * Logged, never rethrown. The row is already gone by the time this runs;
       * failing the request now would tell a partner their photo could not be
       * deleted when it already has been, and the orphaned object costs
       * fractions of a cent while a confusing error costs a support ticket.
       */
      this.logger.warn(`Could not remove ${key}: ${(error as Error).message}`)
    }
  }
}
