import {
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from "@nestjs/common"
import type { Request, Response } from "express"
import { tap } from "rxjs/operators"
import type { Observable } from "rxjs"

/**
 * One access-log line per request: method, path, status, duration.
 *
 * The path is the ROUTE pattern (`/api/v1/bookings/:id`), not the concrete
 * URL — a booking reference in a log line is a guest-identifying value, and
 * grouping by route is what makes latency numbers readable anyway.
 *
 * Query strings are dropped for the same reason: they carry emails and dates.
 */
@Injectable()
export class AccessLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP")

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle()

    const http = context.switchToHttp()
    const req = http.getRequest<Request>()
    const res = http.getResponse<Response>()
    const startedAt = process.hrtime.bigint()

    const route = routeOf(req)

    return next.handle().pipe(
      tap({
        next: () => this.emit(req.method, route, res.statusCode, startedAt),
        // The exception filter owns the error itself; this only records that
        // the request finished and how long it took to fail.
        error: (err: unknown) => this.emit(req.method, route, statusOf(err), startedAt),
      })
    )
  }

  private emit(method: string, route: string, status: number, startedAt: bigint): void {
    const ms = Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000)
    const line = `${method} ${route} ${status} ${ms}ms`
    if (status >= 500) this.logger.error(line)
    else if (status >= 400) this.logger.warn(line)
    else this.logger.log(line)
  }
}

function routeOf(req: Request): string {
  const pattern = (req.route as { path?: string } | undefined)?.path
  if (pattern) return `${req.baseUrl ?? ""}${pattern}`
  // No matched route (a 404) — log the path without its query string.
  return req.originalUrl.split("?")[0] ?? req.originalUrl
}

function statusOf(err: unknown): number {
  if (typeof err === "object" && err !== null && "status" in err) {
    const status = (err as { status: unknown }).status
    if (typeof status === "number") return status
  }
  return 500
}
