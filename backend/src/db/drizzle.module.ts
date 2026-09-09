import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common"
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { env, isProduction } from "../config/env"
import * as schema from "./schema"

/** Inject with `@Inject(DRIZZLE) private readonly db: Database`. */
export const DRIZZLE = Symbol("DRIZZLE")
export const PG_POOL = Symbol("PG_POOL")

export type Database = NodePgDatabase<typeof schema>

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () =>
        // The pool connects lazily, on first query — so the API boots even when
        // Postgres is not up yet. `GET /api/health/db` is what actually proves
        // the connection.
        new Pool({
          connectionString: env.DATABASE_URL,
          max: isProduction ? 20 : 5,
          idleTimeoutMillis: 30_000,
          connectionTimeoutMillis: 5_000,
        }),
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool, { schema }),
    },
  ],
  exports: [DRIZZLE, PG_POOL],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Drains in-flight queries on SIGTERM instead of dropping them. */
  async onApplicationShutdown() {
    await this.pool.end()
  }
}
