import { randomUUID } from "node:crypto"

import { Injectable, type NestMiddleware } from "@nestjs/common"
import type { NextFunction, Request, Response } from "express"

import { runWithRequestContext } from "../context/request-context"

const HEADER = "x-request-id"
/** A generated id is a UUID; anything longer than this is not one of ours. */
const MAX_INBOUND_LENGTH = 128
const SAFE_ID = /^[A-Za-z0-9._-]+$/

/**
 * Opens a request context for the whole lifetime of the request.
 *
 * An inbound `x-request-id` is honoured so a trace can span the Next proxy and
 * this API — but it is validated first. The value is echoed into a response
 * header and written into every log line, and an unvalidated one would let a
 * caller inject newlines into the log stream and forge entries.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = sanitize(req.headers[HEADER]) ?? randomUUID()
    res.setHeader(HEADER, requestId)
    runWithRequestContext({ requestId }, () => next())
  }
}

function sanitize(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (!raw) return undefined
  if (raw.length > MAX_INBOUND_LENGTH) return undefined
  return SAFE_ID.test(raw) ? raw : undefined
}
