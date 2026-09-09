CREATE TABLE "booking_nights" (
	"booking_id" uuid NOT NULL,
	"date" date NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"rate_plan_id" uuid NOT NULL,
	"room_revenue" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_nights_booking_id_date_pk" PRIMARY KEY("booking_id","date"),
	CONSTRAINT "booking_nights_revenue_check" CHECK ("booking_nights"."room_revenue" >= 0)
);
--> statement-breakpoint
CREATE TABLE "search_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"destination" varchar(160) NOT NULL,
	"check_in" date,
	"check_out" date,
	"adults" smallint,
	"children" smallint,
	"result_count" integer DEFAULT 0 NOT NULL,
	"surface" varchar(32) DEFAULT 'web' NOT NULL,
	"session_hash" varchar(64),
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_events_surface_check" CHECK ("search_events"."surface" IN ('web', 'mobile_web', 'app')),
	CONSTRAINT "search_events_result_count_check" CHECK ("search_events"."result_count" >= 0),
	CONSTRAINT "search_events_dates_check" CHECK (("search_events"."check_in" IS NULL) = ("search_events"."check_out" IS NULL)
          AND ("search_events"."check_out" IS NULL OR "search_events"."check_out" > "search_events"."check_in"))
);
--> statement-breakpoint
CREATE TABLE "search_impressions" (
	"search_event_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"clicked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_impressions_search_event_id_property_id_pk" PRIMARY KEY("search_event_id","property_id"),
	CONSTRAINT "search_impressions_position_check" CHECK ("search_impressions"."position" >= 1)
);
--> statement-breakpoint
ALTER TABLE "booking_nights" ADD CONSTRAINT "booking_nights_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_nights" ADD CONSTRAINT "booking_nights_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_nights" ADD CONSTRAINT "booking_nights_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_nights" ADD CONSTRAINT "booking_nights_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_events" ADD CONSTRAINT "search_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_impressions" ADD CONSTRAINT "search_impressions_search_event_id_search_events_id_fk" FOREIGN KEY ("search_event_id") REFERENCES "public"."search_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_impressions" ADD CONSTRAINT "search_impressions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_nights_property_date_idx" ON "booking_nights" USING btree ("property_id","date");--> statement-breakpoint
CREATE INDEX "booking_nights_room_date_idx" ON "booking_nights" USING btree ("room_id","date");--> statement-breakpoint
CREATE INDEX "search_events_destination_created_idx" ON "search_events" USING btree ("destination","created_at");--> statement-breakpoint
CREATE INDEX "search_events_created_idx" ON "search_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "search_impressions_property_created_idx" ON "search_impressions" USING btree ("property_id","created_at");