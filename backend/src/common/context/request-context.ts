import { AsyncLocalStorage } from "node:async_hooks"

/**
 * Per-request context, carried without threading it through every signature.
 *
 * A log line written six layers deep inside a booking transaction has to be
 * traceable back to the request that caused it. Passing a request id down by
 * hand means every service method grows a parameter it does not otherwise
 * need — and one missed call site breaks the trail exactly where a hard bug
 * would be.
 *
 * NOTE: this holds identifiers only. Never put PII here — logs are the one
 * place a stray email address is hardest to get back out of.
 */
export type RequestContext = {
  requestId: string
  /** Populated by the auth guard once sessions exist (Module 1). */
  userId?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn)
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore()
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId
}

/** Lets the auth layer attach the caller once it knows who they are. */
export function setContextUserId(userId: string): void {
  const store = storage.getStore()
  if (store) store.userId = userId
}
