CREATE TABLE "promotion_properties" (
	"promotion_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	CONSTRAINT "promotion_properties_promotion_id_property_id_pk" PRIMARY KEY("promotion_id","property_id")
);
--> statement-breakpoint
CREATE TABLE "promotion_rooms" (
	"promotion_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	CONSTRAINT "promotion_rooms_promotion_id_room_id_pk" PRIMARY KEY("promotion_id","room_id")
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"partner_org_id" uuid,
	"name" varchar(160) NOT NULL,
	"kind" varchar(32) DEFAULT 'seasonal_deal' NOT NULL,
	"discount_type" varchar(32) NOT NULL,
	"discount_value" integer NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"min_stay" smallint,
	"channel" varchar(32) DEFAULT 'all' NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_discount_type_check" CHECK ("promotions"."discount_type" IN ('percent', 'amount', 'free_night')),
	CONSTRAINT "promotions_status_check" CHECK ("promotions"."status" IN ('draft', 'scheduled', 'active', 'paused', 'ended')),
	CONSTRAINT "promotions_channel_check" CHECK ("promotions"."channel" IN ('all', 'mobile', 'genius')),
	CONSTRAINT "promotions_kind_check" CHECK ("promotions"."kind" IN ('seasonal_deal', 'limited_time', 'member_exclusive', 'group_booking', 'early_bird', 'last_minute', 'flash')),
	CONSTRAINT "promotions_window_check" CHECK ("promotions"."end_date" >= "promotions"."start_date"),
	CONSTRAINT "promotions_min_stay_check" CHECK ("promotions"."min_stay" IS NULL OR "promotions"."min_stay" >= 1),
	CONSTRAINT "promotions_discount_value_check" CHECK ("promotions"."discount_value" > 0
          AND ("promotions"."discount_type" <> 'percent' OR "promotions"."discount_value" <= 100))
);
--> statement-breakpoint
ALTER TABLE "promotion_properties" ADD CONSTRAINT "promotion_properties_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_properties" ADD CONSTRAINT "promotion_properties_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_rooms" ADD CONSTRAINT "promotion_rooms_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_rooms" ADD CONSTRAINT "promotion_rooms_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_partner_org_id_partner_orgs_id_fk" FOREIGN KEY ("partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promotion_properties_property_idx" ON "promotion_properties" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "promotion_rooms_room_idx" ON "promotion_rooms" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "promotions_status_dates_idx" ON "promotions" USING btree ("status","start_date","end_date");--> statement-breakpoint
CREATE INDEX "promotions_org_idx" ON "promotions" USING btree ("partner_org_id");