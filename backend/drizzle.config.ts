import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Migrations are reviewed and committed, never auto-pushed to a shared
  // database. `db:push` is for a local scratch DB only.
  strict: true,
  verbose: true,
})
