ALTER TABLE "rate_plans" DROP CONSTRAINT "rate_plans_status_check";--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "status" varchar(32) DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "rate_plans_one_default" ON "rate_plans" USING btree ("room_id") WHERE is_default = true AND status = 'active';--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_status_check" CHECK ("rate_plans"."status" IN ('active', 'draft', 'archived'));--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_status_check" CHECK ("rooms"."status" IN ('active', 'archived'));