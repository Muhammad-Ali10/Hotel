/**
 * The one error type the UI has to understand.
 *
 * The API answers every failure in one shape (`backend/src/common/filters/
 * all-exceptions.filter.ts`):
 *
 *     { statusCode, code, message, path, ...extras }
 *
 * `extras` is not decoration. A 409 from a lost booking race carries
 * `{ code: "just_sold_out", alternatives: [...] }` — the rooms that ARE still
 * free. Flattening it to a message hands the guest a dead end instead of the
 * next thing to click, so everything past `message` is kept.
 */
export class ApiError extends Error {
  readonly statusCode: number
  /** Machine-readable, e.g. `not_found`, `just_sold_out`. */
  readonly code: string
  /** Whatever else the failure deliberately attached. */
  readonly extras: Record<string, unknown>

  constructor(input: {
    statusCode: number
    code: string
    message: string
    extras?: Record<string, unknown>
  }) {
    super(input.message)
    this.name = "ApiError"
    this.statusCode = input.statusCode
    this.code = input.code
    this.extras = input.extras ?? {}
  }

  /** Not signed in — the caller should send them to `/login`. */
  get isUnauthorized() {
    return this.statusCode === 401
  }

  /** Signed in, but not allowed. Different from 401: signing in again won't help. */
  get isForbidden() {
    return this.statusCode === 403
  }

  get isNotFound() {
    return this.statusCode === 404
  }

  /**
   * Worth trying again unchanged.
   *
   * A 409 is deliberately absent: the room really was taken, and repeating the
   * same request cannot make it free.
   */
  get isRetryable() {
    return this.statusCode === 0 || this.statusCode === 429 || this.statusCode >= 500
  }
}

/**
 * Turns a failed response into an `ApiError`.
 *
 * A body that is not JSON at all — a proxy's HTML error page, a dropped
 * connection mid-response — still has to produce something the UI can render,
 * so the status is always enough on its own.
 */
export async function errorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown = null
  try {
    body = await response.json()
  } catch {
    // Not JSON. The status alone will have to do.
  }

  if (body === null || typeof body !== "object") {
    return new ApiError({
      statusCode: response.status,
      code: "unexpected",
      message: response.statusText || "Something went wrong",
    })
  }

  const { statusCode, code, message, path, ...extras } = body as Record<string, unknown>
  void path

  return new ApiError({
    statusCode: typeof statusCode === "number" ? statusCode : response.status,
    code: typeof code === "string" ? code : "unexpected",
    // Zod failures arrive as an array of issues; the first is the one to show.
    message: messageOf(message) ?? response.statusText ?? "Something went wrong",
    extras,
  })
}

/**
 * The network never answered at all.
 *
 * Status `0` because there was no status: the request never reached the API.
 * Given its own code so the UI can say "check your connection" rather than
 * blaming the server for something it never saw.
 */
export function networkError(cause: unknown): ApiError {
  const error = new ApiError({
    statusCode: 0,
    code: "network",
    message: "Could not reach Stayora. Check your connection and try again.",
  })
  error.cause = cause
  return error
}

function messageOf(message: unknown): string | null {
  if (typeof message === "string") return message
  if (Array.isArray(message) && typeof message[0] === "string") return message[0]
  return null
}
