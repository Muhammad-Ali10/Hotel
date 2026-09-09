import type { INestApplication } from "@nestjs/common"
import express from "express"
import type { NextFunction, Request, Response } from "express"

/** 256 KB. Nothing this API accepts is anywhere near it (API4). */
export const BODY_LIMIT = "256kb"

/** The paths whose raw bytes have to survive the JSON parser. */
const RAW_BODY_PATHS = ["/payments/webhook"]

/**
 * The local upload route, and its own much larger limit (rule #73).
 *
 * Photos are 5MB, and the 256KB ceiling everywhere else is deliberate — it is
 * what keeps a JSON endpoint from being handed a megabyte of nonsense. Raising
 * it globally to make one route work would remove that protection from every
 * other route on the API, so the exception is scoped to the one path.
 *
 * Only the FAKE storage driver ever serves this: with `s3` the browser writes
 * straight to the bucket and no file passes through this process at all.
 */
const UPLOAD_PATH = "/files/upload"
const UPLOAD_LIMIT = "6mb"

/**
 * Body parsing, defined ONCE and applied by both the server and the tests.
 *
 * Not a convenience. The payment webhook verifies a signature over the exact
 * bytes the provider sent, and `JSON.parse` → `JSON.stringify` does not
 * reproduce them — key order, whitespace and number formatting all drift. So
 * the raw buffer is stashed by `verify`, which is the last point at which it
 * still exists.
 *
 * When the test harness built its own parser instead, every webhook it sent
 * arrived with no raw body. Sharing this is what makes a passing signature
 * test evidence about the real server rather than about the harness.
 */
export function applyBodyParsers(app: INestApplication): void {
  app.use(
    express.json({
      limit: BODY_LIMIT,
      verify: (req, _res, buf) => {
        const url = (req as Request).originalUrl ?? (req as Request).url ?? ""
        if (RAW_BODY_PATHS.some((path) => url.includes(path))) {
          ;(req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf)
        }
      },
    })
  )
  app.use(express.urlencoded({ extended: false, limit: BODY_LIMIT }))

  /*
   * Binary, and only here.
   *
   * Matched on the END of the path, not mounted at it. `app.use("/files/upload")`
   * matches from the mount point, and the real request arrives at
   * `/api/v1/files/upload` — the global prefix and the version sit in front. The
   * mounted form silently never fired, so every upload reached the handler with
   * no body and was refused as empty.
   *
   * `type: () => true` because a browser sends the image's own content type,
   * not one this parser could enumerate in advance.
   */
  const raw = express.raw({ type: () => true, limit: UPLOAD_LIMIT })
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (!req.path.endsWith(UPLOAD_PATH)) return next()
    return raw(req, res, next)
  })
}
