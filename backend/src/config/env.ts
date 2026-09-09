import "dotenv/config"
import { z } from "zod"

/**
 * Environment is parsed once, at import time, and the process refuses to boot
 * on a bad value. A missing DATABASE_URL should fail here — loudly, at start —
 * not three hours later inside a booking transaction.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  /*
   * The interface to bind. `0.0.0.0` locally; `127.0.0.1` behind a proxy.
   *
   * Not cosmetic. `trust proxy` is set to one hop, so the API BELIEVES the
   * `X-Forwarded-For` it is handed — correct when the only thing that can
   * reach it is nginx. Leave the port open to the internet as well and anyone
   * can address it directly, set that header themselves, and be a new client
   * on every request: the rate limiter counts nothing, and the audit log
   * records whichever address the caller preferred.
   */
  HOST: z.string().default("0.0.0.0"),

  /** postgres://user:pass@host:5432/stayora */
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /**
   * The suite's own database. Required when NODE_ENV=test.
   *
   * The specs `TRUNCATE ... CASCADE` between files. Pointed at the development
   * database that is ALSO what `npm run dev` is serving, that is not a test
   * setup — it is two writers racing: the seeded catalogue disappears mid-run,
   * a live request lands between the truncate and the re-insert, and the
   * failure surfaces in whichever spec happened to be running. Every one of
   * those looks like a bug in the code under test.
   *
   * Required rather than defaulted, because a silent fallback to
   * `DATABASE_URL` is the exact accident this exists to stop.
   */
  TEST_DATABASE_URL: z.string().optional(),

  /** Signs the session cookie. Generate with: openssl rand -base64 48 */
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 chars"),

  /** The Next app. Only used for direct browser calls — the proxy path is same-origin. */
  WEB_ORIGIN: z.url().default("http://localhost:3000"),

  /** Cookie domain — leave unset for localhost, set to .stayora.com in production. */
  COOKIE_DOMAIN: z.string().optional(),

  /*
   * Whether the session cookie may only travel over TLS.
   *
   * Defaults to true in production, which is the right default — but this is a
   * fact about the TRANSPORT, not about the build mode, and tying the two
   * together made a real configuration unreachable. A staging box served over
   * plain HTTP on an IP address runs in production mode like any other: the
   * API would set a `Secure` cookie, the browser would silently drop it, and
   * every request after a SUCCESSFUL login would answer 401 with nothing in
   * any log to say why.
   *
   * Parsed as the two literal strings rather than coerced: `Boolean("false")`
   * is `true`, and an env var that reads as its own opposite is worse than one
   * that refuses to parse.
   */
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),

  /**
   * Twilio SendGrid (rule #55).
   *
   * Optional so the API boots without it — development and the test suite run
   * on the fake provider. A missing key is a message that fails permanently
   * rather than a process that will not start, which is the right trade for a
   * channel nothing else depends on.
   */
  SENDGRID_API_KEY: z.string().optional(),
  MAIL_FROM: z.string().default("no-reply@stayora.com"),
  MAIL_FROM_NAME: z.string().default("Stayora"),
  /**
   * Which adapter is wired in.
   *
   * `fake` outside production so nobody's first local booking sends a real
   * email to a real address that happens to be in the seed data.
   */
  MAIL_DRIVER: z.enum(["sendgrid", "fake"]).default("fake"),

  /* ------------------------------------------------------------ storage -- */

  /**
   * Where property photos live (rule #73).
   *
   * S3-COMPATIBLE, not S3. Cloudflare R2, AWS S3 and MinIO all speak the same
   * protocol, so an endpoint plus a bucket covers every one of them and the
   * product never has to care which is on the other end.
   *
   * `fake` writes to disk and is the default: a first local upload should not
   * need a cloud account, and the test suite must not need the network.
   */
  STORAGE_DRIVER: z.enum(["s3", "fake"]).default("fake"),
  STORAGE_ENDPOINT: z.string().optional(),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_BUCKET: z.string().default("stayora-photos"),
  STORAGE_ACCESS_KEY_ID: z.string().optional(),
  STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
  /**
   * Where a browser reads the objects from — usually a CDN, not the bucket.
   *
   * Separate from `STORAGE_ENDPOINT` because the write path and the read path
   * are genuinely different hosts in every real deployment: uploads go to the
   * bucket, reads come off the edge.
   */
  STORAGE_PUBLIC_URL: z.string().default("http://localhost:4000/api/v1/files"),
})
  /*
   * A real driver needs real credentials.
   *
   * Checked here rather than at the first upload: an API that boots happily
   * and then fails every photo upload in production is worse than one that
   * refuses to start and says why.
   */
  /*
   * The same for mail.
   *
   * `SendGridProvider` answers "SENDGRID_API_KEY is not set" as a PERMANENT
   * failure — correctly, since the next attempt has the same configuration.
   * The effect was an API that booted, looked healthy, and quietly burned
   * every confirmation, every verification link and every payout notice one at
   * a time. A missing key is a deployment mistake, and it belongs here.
   */
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "test" && !value.TEST_DATABASE_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["TEST_DATABASE_URL"],
        message:
          "required when NODE_ENV is test — the suite truncates tables, and it must not " +
          "be pointed at a database anything else is using",
      })
    }
  })
  .superRefine((value, ctx) => {
    if (value.MAIL_DRIVER === "sendgrid" && !value.SENDGRID_API_KEY) {
      ctx.addIssue({
        code: "custom",
        path: ["SENDGRID_API_KEY"],
        message: "required when MAIL_DRIVER is sendgrid",
      })
    }
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER !== "s3") return
    for (const key of ["STORAGE_ENDPOINT", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"] as const) {
      if (!value[key]) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "required when STORAGE_DRIVER is s3",
        })
      }
    }
  })

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  · ${issue.path.join(".")}: ${issue.message}`)
    .join("\n")
  throw new Error(`Invalid environment.\n${issues}\n\nCopy .env.example to .env and fill it in.`)
}

/*
 * One resolved URL, so nothing downstream has to remember the rule.
 *
 * `drizzle.module` asks for `env.DATABASE_URL` and gets the right database for
 * the mode it is running in. A caller that had to check NODE_ENV itself would
 * be a caller that could forget to.
 */
const isTest = parsed.data.NODE_ENV === "test"

export const env = {
  ...parsed.data,

  DATABASE_URL:
    isTest && parsed.data.TEST_DATABASE_URL
      ? parsed.data.TEST_DATABASE_URL
      : parsed.data.DATABASE_URL,

  /*
   * The suite never touches the outside world. Not configurably — never.
   *
   * `MAIL_DRIVER=sendgrid` in a developer's .env is the normal thing to have
   * once mail is set up. The suite then inherited it and started REALLY
   * SENDING: to `amelia@example.com`, `queue@example.com`, `race@example.com`
   * — a full run is dozens of messages to addresses that do not exist. They
   * bounce, and a sending domain is judged on its bounce rate, so the cost
   * lands on every real confirmation the product sends afterwards.
   *
   * Overridden rather than validated, because there is no configuration in
   * which a test run should email a stranger. Twenty-four specs read the fake
   * provider's outbox to assert what was sent, so this is also the only
   * setting under which they can mean anything.
   */
  MAIL_DRIVER: isTest ? ("fake" as const) : parsed.data.MAIL_DRIVER,

  /** Same reasoning: a test run must not write to a real bucket. */
  STORAGE_DRIVER: isTest ? ("fake" as const) : parsed.data.STORAGE_DRIVER,

  /** Explicit when given; otherwise on in production and off everywhere else. */
  COOKIE_SECURE: parsed.data.COOKIE_SECURE ?? parsed.data.NODE_ENV === "production",
}
export type Env = typeof env

export const isProduction = env.NODE_ENV === "production"
