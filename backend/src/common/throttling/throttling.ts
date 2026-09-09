import { Throttle, seconds, type ThrottlerModuleOptions } from "@nestjs/throttler"

/**
 * Rate limits (docs/ARCHITECTURE.md §5, API4).
 *
 * ONE global bucket, tightened per route.
 *
 * The obvious-looking alternative — declaring named `auth` / `quote` /
 * `booking` throttlers alongside `default` — does not do what it reads like:
 * every named throttler applies to EVERY route, so declaring an `auth` bucket
 * of 5/min silently caps the whole API at 5 requests a minute. A health probe
 * started returning 429 in the foundation suite, which is how this was found.
 *
 * So there is a single bucket, and the decorators below narrow it where a route
 * needs less. Skipping it (`@SkipThrottle()`) then behaves as it reads.
 */
export const THROTTLERS: ThrottlerModuleOptions = {
  throttlers: [{ name: "default", ttl: seconds(60), limit: 120 }],
}

/**
 * `@AuthThrottle()` — login, signup, password reset.
 * Brute force and credential stuffing.
 */
export const AuthThrottle = () => Throttle({ default: { ttl: seconds(60), limit: 5 } })

/**
 * `@QuoteThrottle()` — availability and price quotes.
 * Pricing is the most expensive read in the product, and a scraper walking a
 * rate calendar looks exactly like a keen guest.
 */
export const QuoteThrottle = () => Throttle({ default: { ttl: seconds(60), limit: 30 } })

/**
 * `@BookingThrottle()` — create, modify, cancel.
 * Writes hold inventory: a flood of pending holds can take a property off sale
 * without paying a cent (API6).
 */
export const BookingThrottle = () => Throttle({ default: { ttl: seconds(60), limit: 10 } })

/**
 * `@ContentThrottle()` — reviews and partner replies.
 *
 * Guest-written content, and the limit is on ATTEMPTS rather than successes: a
 * guest can only review a stay once, but nothing stops a bot spraying POSTs at
 * random booking ids to find valid ones, and each attempt costs two queries.
 */
export const ContentThrottle = () => Throttle({ default: { ttl: seconds(60), limit: 10 } })
