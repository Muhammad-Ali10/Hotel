/**
 * The swap seam between mock data and a real backend.
 *
 * Every endpoint in `endpoints.ts` goes through `request()`. To move to a real
 * API, reimplement this one function with `fetch` — the endpoint signatures,
 * the react-query hooks and every component stay unchanged.
 *
 * In mock mode it simulates network latency so the skeleton states are real
 * rather than decorative, and can inject failures so the error states are
 * reachable in development.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number = 500,
    readonly code: string = "internal_error"
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export class NotFoundError extends ApiError {
  constructor(what: string) {
    super(`${what} not found`, 404, "not_found")
    this.name = "NotFoundError"
  }
}

type RequestOptions = {
  /** Override the simulated latency, in ms. */
  delay?: number
  /** 0–1 probability of a simulated failure. Defaults to `MOCK_FAILURE_RATE`. */
  failureRate?: number
}

/**
 * Set `NEXT_PUBLIC_ADMIN_MOCK_FAILURE_RATE=0.2` to exercise error states, or
 * `NEXT_PUBLIC_ADMIN_MOCK_LATENCY=0` to make the panel feel instant.
 */
const MOCK_FAILURE_RATE = Number(
  process.env.NEXT_PUBLIC_ADMIN_MOCK_FAILURE_RATE ?? 0
)

const MOCK_LATENCY = Number(process.env.NEXT_PUBLIC_ADMIN_MOCK_LATENCY ?? 320)

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function request<T>(
  resolve: () => T,
  options: RequestOptions = {}
): Promise<T> {
  const delay = options.delay ?? MOCK_LATENCY
  if (delay > 0) {
    // Jitter keeps concurrent panels from resolving in lockstep.
    await sleep(delay + Math.round(delay * 0.4 * (0.5 - deterministicJitter())))
  }

  const failureRate = options.failureRate ?? MOCK_FAILURE_RATE
  if (failureRate > 0 && deterministicJitter() < failureRate) {
    throw new ApiError(
      "The platform API is temporarily unavailable.",
      503,
      "service_unavailable"
    )
  }

  return resolve()
}

/**
 * A cheap pseudo-random source. Kept in one place so the mock layer has a
 * single point of non-determinism that can be stubbed in tests.
 */
function deterministicJitter() {
  return Math.random()
}

/* ------------------------------------------------------- list utilities */

export type SortDirection = "asc" | "desc"

export type ListParams = {
  search?: string
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: SortDirection
  /** Column → allowed values. An empty array means "no filter". */
  filters?: Record<string, string[]>
}

/**
 * Applies search, filtering, sorting and pagination the way a real list
 * endpoint would, so components never hold the full dataset in memory.
 */
export function applyListParams<T extends Record<string, unknown>>(
  rows: T[],
  params: ListParams,
  options: {
    /** Fields concatenated for free-text search. */
    searchFields: (row: T) => string[]
    /** Resolves a sort key to a comparable value. */
    sortValue?: (row: T, key: string) => string | number
    /** Resolves a filter key to the row's value. */
    filterValue?: (row: T, key: string) => string
  }
) {
  let out = rows

  const term = params.search?.trim().toLowerCase()
  if (term) {
    out = out.filter((row) =>
      options
        .searchFields(row)
        .some((field) => field?.toLowerCase().includes(term))
    )
  }

  for (const [key, values] of Object.entries(params.filters ?? {})) {
    if (!values.length) continue
    out = out.filter((row) => {
      const value = options.filterValue
        ? options.filterValue(row, key)
        : String(row[key] ?? "")
      return values.includes(value)
    })
  }

  if (params.sortBy) {
    const key = params.sortBy
    const dir = params.sortDir === "desc" ? -1 : 1
    const read = options.sortValue ?? ((row: T, k: string) => row[k] as string)
    out = [...out].sort((a, b) => {
      const av = read(a, key)
      const bv = read(b, key)
      if (av === bv) return 0
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir
      }
      return String(av).localeCompare(String(bv), "en") * dir
    })
  }

  const total = out.length
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  const start = (page - 1) * pageSize

  return { rows: out.slice(start, start + pageSize), total }
}
