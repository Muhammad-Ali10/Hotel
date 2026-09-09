import { ConsoleLogger, type LoggerService } from "@nestjs/common"

import { getRequestContext } from "../context/request-context"
import { isProduction } from "../../config/env"

/** Emitted severity. Nest calls its info level `log`; JSON consumers expect `info`. */
type JsonLevel = "info" | "warn" | "error" | "debug" | "verbose"

/**
 * Structured JSON logs, one object per line.
 *
 * Pretty console output is fine on a laptop and useless in production, where
 * lines are shipped to a log store and queried. Every line carries the
 * `requestId` from the async context, so a booking failure can be traced from
 * the HTTP request down to the SQL that rejected it.
 *
 * PII never appears here — no email, no phone, no card, no guest name. A
 * `requestId` plus a `userId` is enough to find the person when it matters,
 * and logs are the hardest place to un-leak an address from.
 */
export class JsonLogger implements LoggerService {
  private readonly pretty = new ConsoleLogger()

  log(message: unknown, context?: string): void {
    this.write("info", message, context)
  }

  error(message: unknown, stack?: string, context?: string): void {
    this.write("error", message, context, stack)
  }

  warn(message: unknown, context?: string): void {
    this.write("warn", message, context)
  }

  debug(message: unknown, context?: string): void {
    this.write("debug", message, context)
  }

  verbose(message: unknown, context?: string): void {
    this.write("verbose", message, context)
  }

  private write(level: JsonLevel, message: unknown, context?: string, stack?: string): void {
    // Development keeps Nest's readable output — the JSON is for machines.
    if (!isProduction) {
      switch (level) {
        case "error":
          this.pretty.error(message as string, stack, context)
          return
        case "warn":
          this.pretty.warn(message as string, context)
          return
        default:
          this.pretty.log(message as string, context)
          return
      }
    }

    const entry: Record<string, unknown> = {
      level,
      time: new Date().toISOString(),
      message: typeof message === "string" ? message : safeStringify(message),
    }
    if (context) entry.context = context
    if (stack) entry.stack = stack

    const ctx = getRequestContext()
    if (ctx) {
      entry.requestId = ctx.requestId
      if (ctx.userId) entry.userId = ctx.userId
    }

    process.stdout.write(`${JSON.stringify(entry)}\n`)
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
