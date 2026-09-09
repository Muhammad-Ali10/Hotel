import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common"
import type { Request, Response } from "express"

import { isProduction } from "../../config/env"

/**
 * One error shape for the whole API, so the frontend never has to guess:
 *
 *   { statusCode, code, message, path }
 *
 * This mirrors `ApiError` in frontend/src/lib/admin/api/transport.ts — the mock layer the
 * admin panel already talks to — so swapping the mock for real fetch does not
 * change a single error-handling branch in the UI.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception")

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const isHttp = exception instanceof HttpException
    const status = isHttp ? exception.getStatus() : statusOfPlainError(exception)

    const body = isHttp ? exception.getResponse() : null
    const message =
      typeof body === "string"
        ? body
        : typeof body === "object" && body !== null && "message" in body
          ? (body as { message: string | string[] }).message
          : // A 4xx from Express middleware (a body-parser payload limit, a
            // malformed JSON body) carries a message that is both safe and
            // useful, so it is passed through.
            status < 500 && exception instanceof Error
            ? exception.message
            : // An unhandled throw could carry a connection string or a stack.
              // Never let that reach the browser in production.
              isProduction
              ? "Something went wrong."
              : exception instanceof Error
                ? exception.message
                : "Something went wrong."

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception)
      )
    }

    response.status(status).json({
      statusCode: status,
      code: codeFor(status),
      // Anything else the thrower deliberately attached — a machine-readable
      // `code`, or the alternative rooms that come with a lost race (rule #24).
      //
      // Without this the filter flattened every structured body down to its
      // message: a 409 carrying `{ code: "just_sold_out", alternatives: [...] }`
      // reached the client as a bare "conflict", and the guest was handed a
      // dead end instead of the rooms that were still free.
      ...extrasOf(exception),
      message,
      path: request.url,
    })
  }
}

/**
 * The status a non-Nest error is really asking for.
 *
 * Express middleware throws plain `Error`s that carry their own status —
 * body-parser's payload-too-large is a `413`, a malformed JSON body is a `400`.
 * Treating every non-HttpException as a 500 turned "your upload is too big"
 * into "the server broke", which is both wrong and alarming.
 *
 * Only 4xx/5xx values are honoured, so a stray `status` field on some unrelated
 * object cannot talk the API into returning 200 for a failure.
 */
/**
 * The fields a deliberately-thrown HttpException carried.
 *
 * Only object responses from an `HttpException` are merged — those are ones WE
 * constructed. A plain `Error` that happens to have properties is never spread
 * into a response, because it could be carrying anything.
 */
function extrasOf(exception: unknown): Record<string, unknown> {
  if (!(exception instanceof HttpException)) return {}
  const body = exception.getResponse()
  if (typeof body !== "object" || body === null) return {}

  const { message: _message, statusCode: _statusCode, error: _error, ...rest } = body as Record<string, unknown>
  return rest
}

function statusOfPlainError(exception: unknown): number {
  if (typeof exception === "object" && exception !== null) {
    const candidate =
      (exception as { status?: unknown }).status ?? (exception as { statusCode?: unknown }).statusCode
    if (typeof candidate === "number" && candidate >= 400 && candidate <= 599) {
      return candidate
    }
  }
  return HttpStatus.INTERNAL_SERVER_ERROR
}

function codeFor(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return "bad_request"
    case HttpStatus.UNAUTHORIZED:
      return "unauthorized"
    case HttpStatus.FORBIDDEN:
      return "forbidden"
    case HttpStatus.NOT_FOUND:
      return "not_found"
    case HttpStatus.CONFLICT:
      return "conflict"
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return "validation_failed"
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return "payload_too_large"
    case HttpStatus.TOO_MANY_REQUESTS:
      return "rate_limited"
    case HttpStatus.SERVICE_UNAVAILABLE:
      return "service_unavailable"
    default:
      return status >= 500 ? "internal_error" : "request_failed"
  }
}
