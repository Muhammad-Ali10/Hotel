import { Global, Module } from "@nestjs/common"
import { ThrottlerStorage } from "@nestjs/throttler"

import { JobLockService } from "../scheduling/job-lock.service"
import { PostgresThrottlerStorage } from "./postgres-throttler.storage"
import { RateLimitJobs } from "./rate-limit.jobs"

/**
 * Wires the rate limiter's counters into Postgres.
 *
 * `ThrottlerModule` falls back to an in-memory store when nothing provides
 * `ThrottlerStorage`, and that fallback is per-process: every instance keeps
 * its own count, so N instances mean N times the configured limit. Nothing
 * fails and nothing logs — the protection is just weaker than it reads.
 *
 * `@Global` because `ThrottlerModule.forRoot` is registered in `AppModule` and
 * resolves its storage from the root injector.
 */
@Global()
@Module({
  providers: [
    // Provided here, as every other module with a job does — `JobLockService`
    // is stateless and holds its lock on the connection, not on the instance.
    JobLockService,
    PostgresThrottlerStorage,
    { provide: ThrottlerStorage, useExisting: PostgresThrottlerStorage },
    RateLimitJobs,
  ],
  exports: [ThrottlerStorage, PostgresThrottlerStorage],
})
export class ThrottlingModule {}
