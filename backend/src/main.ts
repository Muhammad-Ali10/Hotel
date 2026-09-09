import "reflect-metadata"

import { Logger, VersioningType } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import type { NestExpressApplication } from "@nestjs/platform-express"
import cookieParser from "cookie-parser"
import helmet from "helmet"

import { AppModule } from "./app.module"
import { applyBodyParsers } from "./common/http/body-parsers"
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter"
import { JsonLogger } from "./common/logging/json-logger"
import { env, isProduction } from "./config/env"

/** Requests larger than this are refused before they reach a controller. */

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: new JsonLogger(),
  })

  // Everything lives under /api, so the whole surface is namespaced and a
  // future proxy can forward one prefix.
  //
  // The browser calls this origin DIRECTLY (`NEXT_PUBLIC_API_URL`) — there is
  // no Next rewrite in front of it. So CORS below is not a convenience for
  // Postman: it is what makes the product work at all, and `WEB_ORIGIN` must
  // name the origin the app is actually served from.
  app.setGlobalPrefix("api")

  // URI versioning from day one. Adding `v1` later breaks every client; adding
  // it now costs nothing. Infrastructure routes opt out with VERSION_NEUTRAL.
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" })

  // The rate limiter keys on X-Forwarded-For, which is only trustworthy when
  // the hop count is known. One hop = the Next proxy.
  app.set("trust proxy", 1)
  app.disable("x-powered-by")

  app.use(helmet())
  app.use(cookieParser(env.SESSION_SECRET))
  applyBodyParsers(app)

  app.useGlobalFilters(new AllExceptionsFilter())

  // No global ValidationPipe on purpose — that one needs class-validator and
  // decorator DTOs. Validation here is zod, applied per route with
  // ZodValidationPipe, so the API and the Next forms can share one schema.

  app.enableCors({
    // One exact origin, never a wildcard: `credentials: true` and `*` are
    // incompatible by spec, and a reflected origin would let any site call
    // this API with the visitor's session cookie attached.
    origin: env.WEB_ORIGIN,
    // Session is an httpOnly cookie, so credentials must be allowed.
    credentials: true,
  })

  // Lets onApplicationShutdown drain the pg pool on SIGTERM.
  app.enableShutdownHooks()

  await app.listen(env.PORT, env.HOST)

  const logger = new Logger("Bootstrap")
  logger.log(`Stayora API → http://localhost:${env.PORT}/api/v1  [${env.NODE_ENV}]`)

  /*
   * Said out loud, every boot, for as long as it is true.
   *
   * Serving production over plain HTTP is a legitimate thing to do on a
   * staging box, and `COOKIE_SECURE=false` is how you say so. It is also
   * exactly what somebody forgets to change on the day it gets a domain — and
   * a session cookie that survives a plaintext hop is one anybody on the path
   * can read and replay. A warning in the log is cheap; finding this later is
   * not.
   */
  if (isProduction && !env.COOKIE_SECURE) {
    logger.warn(
      "COOKIE_SECURE=false in production — the session cookie will be sent over plain HTTP. " +
        "Correct for a staging host without TLS; remove it the moment there is a certificate."
    )
  }
  if (!isProduction) logger.log(`Health check → http://localhost:${env.PORT}/api/health`)
}

void bootstrap()
