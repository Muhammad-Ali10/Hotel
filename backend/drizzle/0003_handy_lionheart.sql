CREATE TABLE "rate_plan_rates" (
	"rate_plan_id" uuid NOT NULL,
	"date" date NOT NULL,
	"rate" integer,
	"min_stay" smallint,
	"min_stay_through" smallint,
	"max_stay" smallint,
	"closed_to_arrival" boolean,
	"closed_to_departure" boolean,
	"min_advance_hours" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_plan_rates_rate_plan_id_date_pk" PRIMARY KEY("rate_plan_id","date"),
	CONSTRAINT "rate_plan_rates_rate_check" CHECK ("rate_plan_rates"."rate" IS NULL OR "rate_plan_rates"."rate" >= 0),
	CONSTRAINT "rate_plan_rates_min_stay_check" CHECK ("rate_plan_rates"."min_stay" IS NULL OR "rate_plan_rates"."min_stay" >= 1),
	CONSTRAINT "rate_plan_rates_min_stay_through_check" CHECK ("rate_plan_rates"."min_stay_through" IS NULL OR "rate_plan_rates"."min_stay_through" >= 1),
	CONSTRAINT "rate_plan_rates_max_stay_check" CHECK ("rate_plan_rates"."max_stay" IS NULL OR "rate_plan_rates"."max_stay" >= 1),
	CONSTRAINT "rate_plan_rates_min_advance_check" CHECK ("rate_plan_rates"."min_advance_hours" IS NULL OR "rate_plan_rates"."min_advance_hours" >= 0),
	CONSTRAINT "rate_plan_rates_stay_range_check" CHECK ("rate_plan_rates"."min_stay" IS NULL OR "rate_plan_rates"."max_stay" IS NULL OR "rate_plan_rates"."max_stay" >= "rate_plan_rates"."min_stay")
);
--> statement-breakpoint
CREATE TABLE "room_inventory" (
	"room_id" uuid NOT NULL,
	"date" date NOT NULL,
	"is_closed" boolean,
	"total_units" smallint NOT NULL,
	"sellable_units" smallint NOT NULL,
	"booked_units" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "room_inventory_room_id_date_pk" PRIMARY KEY("room_id","date"),
	CONSTRAINT "room_inventory_no_overbooking" CHECK ("room_inventory"."booked_units" >= 0 AND "room_inventory"."booked_units" <= "room_inventory"."sellable_units"),
	CONSTRAINT "room_inventory_sellable_check" CHECK ("room_inventory"."sellable_units" >= 0),
	CONSTRAINT "room_inventory_total_check" CHECK ("room_inventory"."total_units" >= 0)
);
--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "same_day_cutoff" varchar(5);--> statement-breakpoint
ALTER TABLE "rate_plans" ADD COLUMN "default_max_stay" smallint;--> statement-breakpoint
ALTER TABLE "rate_plan_rates" ADD CONSTRAINT "rate_plan_rates_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_inventory" ADD CONSTRAINT "room_inventory_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_plan_rates_date_idx" ON "rate_plan_rates" USING btree ("date");--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_max_stay_check" CHECK ("rate_plans"."default_max_stay" IS NULL OR "rate_plans"."default_max_stay" >= "rate_plans"."default_min_stay");