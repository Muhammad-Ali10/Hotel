-- UNLOGGED, deliberately: this is the only table in the schema that skips the
-- WAL, and it is the only one that should. A row here is a counter that expires
-- within the minute; writing every one of them durably would put a WAL flush on
-- the path of every request in the product, for state that a crash may safely
-- forget. Losing it resets the limits, which is what a deploy does anyway.
--
-- Drizzle cannot express UNLOGGED, so it is written here by hand. Regenerating
-- this file will drop the keyword — the ALTER below is the belt to that braces.
CREATE UNLOGGED TABLE "rate_limits" (
	"key" varchar(255) PRIMARY KEY NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"blocked_until" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "rate_limits_expires_idx" ON "rate_limits" USING btree ("expires_at");

--> statement-breakpoint
-- Idempotent, and the safety net if the CREATE above is ever regenerated
-- without the keyword.
ALTER TABLE "rate_limits" SET UNLOGGED;
