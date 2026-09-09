/* ============================================================================
 * PM2 — Stayora's two processes on a box that is already running others.
 *
 *   pm2 start deploy/ecosystem.config.cjs
 *   pm2 save
 *
 * `.cjs`, not `.js`: PM2 loads this with `require`, and the repo has ESM
 * elsewhere. The extension is what keeps that unambiguous.
 *
 * Everything is named `stayora-*` so `pm2 list` stays readable beside the other
 * projects, and `pm2 restart stayora-api` can only ever mean one thing.
 * ========================================================================== */

const path = require("node:path")

const ROOT = path.resolve(__dirname, "..")

module.exports = {
  apps: [
    {
      name: "stayora-api",
      cwd: path.join(ROOT, "backend"),
      script: "dist/main.js",

      /*
       * `fork`, not `cluster`.
       *
       * Cluster mode would be safe here — the cron jobs take a Postgres
       * advisory lock precisely so several instances can run without each of
       * them sending the same email — but this box already carries two other
       * projects. One process that is comfortable beats four that make the
       * neighbours swap. Raise it when the traffic asks, not before.
       */
      instances: 1,
      exec_mode: "fork",

      /*
       * Read from backend/.env by the app itself (dotenv, at import time), so
       * secrets live in one file with one set of permissions rather than being
       * copied into a second one that gets committed by accident.
       *
       * Only NODE_ENV is here, because it decides how .env itself is read.
       */
      env: { NODE_ENV: "production" },

      // A restart loop should be loud, not silent. Ten in a row means the
      // config is wrong and no amount of restarting will fix it.
      max_restarts: 10,
      min_uptime: "20s",
      restart_delay: 2000,

      // Next to the other projects' logs, named so they can be told apart.
      out_file: "/var/log/stayora/api.out.log",
      error_file: "/var/log/stayora/api.err.log",
      merge_logs: true,
      time: true,

      // The API logs JSON. Rotating on size keeps a chatty day from filling
      // the disk the other two projects also live on.
      max_memory_restart: "400M",
    },

    {
      name: "stayora-web",
      cwd: path.join(ROOT, "frontend"),

      /*
       * `next start` through the local binary rather than `npm start`: npm
       * inserts a shell between PM2 and node, and a signal sent to that shell
       * does not always reach the server. PM2 then reports a clean stop while
       * the port stays bound.
       */
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3020",

      instances: 1,
      exec_mode: "fork",

      /*
       * `-H 127.0.0.1` above and `HOST=127.0.0.1` in the API's .env are the
       * same decision: nginx is the only thing that should be able to reach
       * either process. The API trusts one proxy hop for `X-Forwarded-For`, so
       * a directly reachable port lets a caller name their own IP and be a
       * fresh client on every request — the rate limiter would count nothing.
       */
      env: { NODE_ENV: "production" },

      max_restarts: 10,
      min_uptime: "20s",
      restart_delay: 2000,

      out_file: "/var/log/stayora/web.out.log",
      error_file: "/var/log/stayora/web.err.log",
      merge_logs: true,
      time: true,

      // Next holds more resident memory than the API. Generous, but bounded:
      // an OOM here should restart Stayora, not have the kernel pick a victim
      // among the other projects.
      max_memory_restart: "700M",
    },
  ],
}
