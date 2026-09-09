CREATE TABLE "amenities" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"label" varchar(80) NOT NULL,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"icon" varchar(64) DEFAULT 'check' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amenities_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"category" varchar(32) DEFAULT 'exterior' NOT NULL,
	"caption" varchar(200) DEFAULT '' NOT NULL,
	"position" smallint DEFAULT 0 NOT NULL,
	"seed" varchar(64) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "photos_category_check" CHECK ("photos"."category" IN ('exterior', 'interior', 'rooms', 'amenities', 'dining'))
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"name" varchar(160) NOT NULL,
	"city" varchar(120) NOT NULL,
	"country" varchar(80) NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"type" varchar(32) DEFAULT 'hotel' NOT NULL,
	"stars" smallint,
	"description" text DEFAULT '' NOT NULL,
	"base_price" integer DEFAULT 0 NOT NULL,
	"partner_org_id" uuid,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"verification" varchar(32) DEFAULT 'not_submitted' NOT NULL,
	"check_in_time" varchar(5) DEFAULT '15:00' NOT NULL,
	"check_out_time" varchar(5) DEFAULT '12:00' NOT NULL,
	"policy_payment" text DEFAULT '' NOT NULL,
	"policy_pets" text DEFAULT '' NOT NULL,
	"policy_smoking" text DEFAULT '' NOT NULL,
	"policy_children" text DEFAULT '' NOT NULL,
	"seed" varchar(64) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "properties_slug_unique" UNIQUE("slug"),
	CONSTRAINT "properties_type_check" CHECK ("properties"."type" IN ('hotel', 'resort')),
	CONSTRAINT "properties_status_check" CHECK ("properties"."status" IN ('draft', 'pending_review', 'changes_requested', 'active', 'rejected', 'suspended')),
	CONSTRAINT "properties_verification_check" CHECK ("properties"."verification" IN ('not_submitted', 'submitted', 'reviewed')),
	CONSTRAINT "properties_stars_check" CHECK ("properties"."stars" IS NULL OR ("properties"."stars" >= 1 AND "properties"."stars" <= 5)),
	CONSTRAINT "properties_base_price_check" CHECK ("properties"."base_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "property_amenities" (
	"property_id" uuid NOT NULL,
	"amenity_id" uuid NOT NULL,
	CONSTRAINT "property_amenities_property_id_amenity_id_pk" PRIMARY KEY("property_id","amenity_id")
);
--> statement-breakpoint
CREATE TABLE "rate_plans" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"room_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"base_price" integer NOT NULL,
	"cancel_free_until" varchar(32) DEFAULT '48h' NOT NULL,
	"cancel_charge" varchar(32) DEFAULT 'percent' NOT NULL,
	"cancel_charge_value" smallint,
	"inclusions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_min_stay" smallint DEFAULT 1 NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_plans_base_price_check" CHECK ("rate_plans"."base_price" >= 0),
	CONSTRAINT "rate_plans_min_stay_check" CHECK ("rate_plans"."default_min_stay" >= 1),
	CONSTRAINT "rate_plans_status_check" CHECK ("rate_plans"."status" IN ('active', 'draft')),
	CONSTRAINT "rate_plans_free_until_check" CHECK ("rate_plans"."cancel_free_until" IN ('6pm_arrival', '24h', '48h', '7d', '14d', 'non_refundable')),
	CONSTRAINT "rate_plans_charge_check" CHECK ("rate_plans"."cancel_charge" IN ('first_night', 'percent', 'full')),
	CONSTRAINT "rate_plans_charge_value_check" CHECK (("rate_plans"."cancel_charge" = 'percent' AND "rate_plans"."cancel_charge_value" BETWEEN 1 AND 100)
          OR ("rate_plans"."cancel_charge" <> 'percent' AND "rate_plans"."cancel_charge_value" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"max_adults" smallint DEFAULT 2 NOT NULL,
	"max_children" smallint DEFAULT 0 NOT NULL,
	"max_occupancy" smallint DEFAULT 2 NOT NULL,
	"bed" varchar(80) DEFAULT '' NOT NULL,
	"size" smallint DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"units" smallint DEFAULT 1 NOT NULL,
	"seed" varchar(64) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rooms_max_adults_check" CHECK ("rooms"."max_adults" >= 1),
	CONSTRAINT "rooms_max_children_check" CHECK ("rooms"."max_children" >= 0),
	CONSTRAINT "rooms_max_occupancy_check" CHECK ("rooms"."max_occupancy" >= "rooms"."max_adults" AND "rooms"."max_occupancy" <= "rooms"."max_adults" + "rooms"."max_children"),
	CONSTRAINT "rooms_units_check" CHECK ("rooms"."units" >= 0)
);
--> statement-breakpoint
CREATE TABLE "value_adds" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer NOT NULL,
	"unit" varchar(32) DEFAULT 'per_stay' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "value_adds_price_check" CHECK ("value_adds"."price" >= 0),
	CONSTRAINT "value_adds_unit_check" CHECK ("value_adds"."unit" IN ('per_stay', 'per_night', 'per_person', 'per_person_per_night'))
);
--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_partner_org_id_partner_orgs_id_fk" FOREIGN KEY ("partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_amenities" ADD CONSTRAINT "property_amenities_amenity_id_amenities_id_fk" FOREIGN KEY ("amenity_id") REFERENCES "public"."amenities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_adds" ADD CONSTRAINT "value_adds_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photos_property_idx" ON "photos" USING btree ("property_id","position");--> statement-breakpoint
CREATE INDEX "properties_city_status_idx" ON "properties" USING btree ("city","status");--> statement-breakpoint
CREATE INDEX "properties_partner_org_idx" ON "properties" USING btree ("partner_org_id");--> statement-breakpoint
CREATE INDEX "property_amenities_amenity_idx" ON "property_amenities" USING btree ("amenity_id");--> statement-breakpoint
CREATE INDEX "rate_plans_room_idx" ON "rate_plans" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "rooms_property_idx" ON "rooms" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "value_adds_property_idx" ON "value_adds" USING btree ("property_id");