import swc from "unplugin-swc"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["src/**/*.spec.ts", "test/**/*.e2e-spec.ts"],
    environment: "node",
    // Nest's DI reads `design:paramtypes` at runtime, so tests need the same
    // decorator metadata the build emits. esbuild (vitest's default) does not
    // produce it; SWC does.
    globals: true,
    // Each suite boots its own Nest app and binds a port — running them in
    // parallel makes them fight over it.
    fileParallelism: false,
    /*
     * `NODE_ENV=test` switches the SCHEDULER off (see app.module.ts).
     *
     * Vitest does not set it, and without it the `@Cron` jobs run during the
     * suite: a single spec finishes inside a minute so they never fire, but a
     * full run lasts several — and the hold sweeper then cancels a pending
     * booking out from under the test that just made it. That is where the
     * intermittent failures came from, and they looked like bugs in the code
     * being tested.
     */
    env: { NODE_ENV: "test" },
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  plugins: [
    swc.vite({
      module: { type: "es6" },
      jsc: {
        target: "es2023",
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
})
