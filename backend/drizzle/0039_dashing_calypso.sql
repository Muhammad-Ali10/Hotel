ALTER TABLE "users" ADD COLUMN "platform_role" varchar(32);--> statement-breakpoint

-- Every administrator that already exists keeps what they already had.
--
-- This has to run BEFORE the CHECK below, which refuses an admin row with a
-- NULL grade — without it the migration fails on the first existing admin.
--
-- `super_admin`, not the safest value, and deliberately: this is a migration,
-- not a policy change. Everyone who could do something yesterday can still do
-- it today; narrowing anybody is a decision for a person to make in the admin
-- panel, with an audit line against their name.
UPDATE "users" SET "platform_role" = 'super_admin' WHERE "role" = 'admin';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_platform_role_check" CHECK (("users"."role" = 'admin' AND "users"."platform_role" IN ('super_admin', 'ops', 'finance', 'support'))
          OR ("users"."role" <> 'admin' AND "users"."platform_role" IS NULL));