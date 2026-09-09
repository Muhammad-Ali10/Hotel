CREATE TABLE "rate_plan_occupancy_prices" (
	"rate_plan_id" uuid NOT NULL,
	"guests" smallint NOT NULL,
	"price" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_plan_occupancy_prices_rate_plan_id_guests_pk" PRIMARY KEY("rate_plan_id","guests"),
	CONSTRAINT "rate_plan_occupancy_guests_check" CHECK ("rate_plan_occupancy_prices"."guests" >= 1 AND "rate_plan_occupancy_prices"."guests" <= 30),
	CONSTRAINT "rate_plan_occupancy_price_check" CHECK ("rate_plan_occupancy_prices"."price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "rate_plans" ADD COLUMN "base_occupancy" smallint DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "rate_plan_occupancy_prices" ADD CONSTRAINT "rate_plan_occupancy_prices_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE cascade ON UPDATE no action;