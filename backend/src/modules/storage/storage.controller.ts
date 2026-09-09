import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"

import {
  BadRequestException,
  Controller,
  Get,
  Header,
  HttpCode,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common"
import type { Request, Response } from "express"

import { Public } from "../../common/auth/decorators"
import { env } from "../../config/env"
import { FakeStorageProvider } from "./provider/fake-storage.provider"

/**
 * The local storage driver's two routes.
 *
 * They exist so a developer can upload a photo without a cloud account, and
 * they stand in for what the bucket does in production. With
 * `STORAGE_DRIVER=s3` the browser writes straight to the bucket and reads off
 * the CDN — nothing here is ever reached, and both routes answer 404 rather
 * than sitting open as a second, unused way into the filesystem.
 *
 * `@Public()` and unauthenticated by design: a presigned URL IS the
 * authorisation. It is signed, it expires, and it names exactly one key.
 * Requiring a session on top would mean a browser upload could not use one.
 */
@Controller("files")
@Public()
export class StorageController {
  constructor(private readonly fake: FakeStorageProvider) {}

  /**
   * Receives one file against a URL this API signed.
   *
   * The signature covers the key AND the expiry, so neither can be edited: a
   * caller who changes the key to overwrite somebody else's photo, or pushes
   * the expiry out, invalidates the very signature they are presenting.
   */
  @Put("upload")
  @HttpCode(204)
  async upload(
    @Query("key") key: string,
    @Query("expires") expires: string,
    @Query("signature") signature: string,
    @Req() request: Request
  ) {
    this.assertLocalDriver()

    if (!key || !expires || !signature) throw new BadRequestException("Malformed upload URL")

    if (!this.fake.verify({ key, expires: Number(expires), signature })) {
      // One message for a forged signature and an expired one alike. Telling
      // the difference would say whether a signature was ever valid.
      throw new BadRequestException("That upload link is no longer valid")
    }

    const body = request.body as unknown
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException("No file received")
    }

    await this.fake.write(key, body)
  }

  /**
   * Serves a stored file.
   *
   * `*path` because a key has slashes in it — `properties/<id>/<uuid>.jpg` —
   * and a single segment parameter would only ever match the first one.
   *
   * `pathFor` refuses any key that escapes the storage root, which is what
   * keeps this from being a way to read arbitrary files. The key is the only
   * part of the request that reaches the filesystem, and it goes through that
   * check first.
   */
  @Get("*path")
  @Header("Cache-Control", "public, max-age=31536000, immutable")
  async serve(@Param("path") path: string | string[], @Res() response: Response) {
    this.assertLocalDriver()

    const key = Array.isArray(path) ? path.join("/") : path
    let file: string
    try {
      file = this.fake.pathFor(key)
    } catch {
      // An escaping key is a 404, not a 400 — a different answer would confirm
      // the traversal was understood and merely refused.
      throw new NotFoundException("Not found")
    }

    try {
      await stat(file)
    } catch {
      throw new NotFoundException("Not found")
    }

    createReadStream(file).pipe(response)
  }

  /**
   * These routes are the local driver's, and nobody else's.
   *
   * A 404 rather than a 403: in an S3 deployment they genuinely do not exist,
   * and saying "forbidden" would advertise a filesystem-backed upload path
   * sitting behind a flag.
   */
  private assertLocalDriver() {
    if (env.STORAGE_DRIVER !== "fake") throw new NotFoundException("Not found")
  }
}
