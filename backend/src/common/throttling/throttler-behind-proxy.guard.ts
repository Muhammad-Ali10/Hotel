import { Injectable } from "@nestjs/common"
import { ThrottlerGuard } from "@nestjs/throttler"
import type { Request } from "express"

/**
 * Rate-limit key that survives a reverse proxy.
 *
 * The API sits behind the Next `proxy.ts` rewrite, so `req.ip` is the proxy
 * for every caller — one shared bucket, and the first noisy client locks
 * everyone else out. `X-Forwarded-For`'s LEFTMOST entry is the original
 * client.
 *
 * ⚠️ This is only trustworthy because a trusted proxy sets the header;
 * `trust proxy` must be configured to match the real hop count in production,
 * or a caller can spoof the header and give themselves a fresh bucket per
 * request. See docs/ARCHITECTURE.md §5 API4.
 */
@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const request = req as unknown as Request
    const forwarded = request.headers["x-forwarded-for"]
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded
    const client = first?.split(",")[0]?.trim()
    return client || request.ip || "unknown"
  }
}
