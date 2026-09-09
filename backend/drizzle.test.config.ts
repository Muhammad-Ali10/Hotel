import "dotenv/config"
import { defineConfig } from "drizzle-kit"

/**
 * The same migrations, applied to the suite's own database.
 *
 * A separate config rather than `NODE_ENV=test drizzle-kit migrate`: that
 * spelling does not work in cmd.exe, which is what npm runs scripts through on
 * Windows, and adding `cross-env` for one line is a dependency for a problem a
 * file solves.
 *
 *   npm run db:migrate:test
 */
export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.TEST_DATABASE_URL!,
  },
  strict: true,
  verbose: true,
})
