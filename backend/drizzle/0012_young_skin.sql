ALTER TABLE "rate_plans" ADD COLUMN "no_show_charge" varchar(32);--> statement-breakpoint
ALTER TABLE "rate_plans" ADD COLUMN "no_show_charge_value" smallint;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "no_show_charge" varchar(32);--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "no_show_charge_value" smallint;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_no_show_charge_check" CHECK ("rate_plans"."no_show_charge" IS NULL OR "rate_plans"."no_show_charge" IN ('first_night', 'percent', 'full'));--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_no_show_value_check" CHECK (("rate_plans"."no_show_charge" = 'percent'
             AND "rate_plans"."no_show_charge_value" IS NOT NULL
             AND "rate_plans"."no_show_charge_value" BETWEEN 1 AND 100)
          OR ("rate_plans"."no_show_charge" IS DISTINCT FROM 'percent' AND "rate_plans"."no_show_charge_value" IS NULL));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_show_charge_check" CHECK ("bookings"."no_show_charge" IS NULL OR "bookings"."no_show_charge" IN ('first_night', 'percent', 'full'));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_show_value_check" CHECK (("bookings"."no_show_charge" = 'percent'
             AND "bookings"."no_show_charge_value" IS NOT NULL
             AND "bookings"."no_show_charge_value" BETWEEN 1 AND 100)
          OR ("bookings"."no_show_charge" IS DISTINCT FROM 'percent' AND "bookings"."no_show_charge_value" IS NULL));