ALTER TABLE "rate_plans" DROP CONSTRAINT "rate_plans_charge_value_check";--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_charge_value_check" CHECK (("rate_plans"."cancel_charge" = 'percent'
             AND "rate_plans"."cancel_charge_value" IS NOT NULL
             AND "rate_plans"."cancel_charge_value" BETWEEN 1 AND 100)
          OR ("rate_plans"."cancel_charge" <> 'percent' AND "rate_plans"."cancel_charge_value" IS NULL));