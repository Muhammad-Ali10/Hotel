import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // The domain layer is pure — no DB, no network, no framework. If a test
    // here needs an environment, the code under test is in the wrong layer.
    environment: "node",
  },
})
