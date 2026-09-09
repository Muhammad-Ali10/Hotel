CREATE TABLE "booking_add_ons" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"booking_id" uuid NOT NULL,
	"value_add_id" uuid,
	"name" varchar(120) NOT NULL,
	"unit" varchar(32) NOT NULL,
	"unit_price" integer NOT NULL,
	"qty" smallint DEFAULT 1 NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_add_ons_qty_check" CHECK ("booking_add_ons"."qty" >= 1),
	CONSTRAINT "booking_add_ons_amount_check" CHECK ("booking_add_ons"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "booking_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"booking_id" uuid NOT NULL,
	"from_status" varchar(32),
	"to_status" varchar(32) NOT NULL,
	"actor_id" uuid,
	"actor" varchar(32) NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_events_actor_check" CHECK ("booking_events"."actor" IN ('guest', 'partner_admin', 'partner_manager', 'partner_staff', 'platform_admin', 'system'))
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"ref" varchar(16) NOT NULL,
	"customer_id" uuid,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"rate_plan_id" uuid NOT NULL,
	"property_name" varchar(160) NOT NULL,
	"room_name" varchar(120) NOT NULL,
	"rate_plan_name" varchar(120) NOT NULL,
	"city" varchar(120) DEFAULT '' NOT NULL,
	"seed" varchar(64) DEFAULT '' NOT NULL,
	"cancel_free_until" varchar(32) NOT NULL,
	"cancel_charge" varchar(32) NOT NULL,
	"cancel_charge_value" smallint,
	"guest_first_name" varchar(80) NOT NULL,
	"guest_last_name" varchar(80) NOT NULL,
	"guest_email" varchar(254) NOT NULL,
	"guest_phone" varchar(32) DEFAULT '' NOT NULL,
	"guest_country" varchar(80) DEFAULT '' NOT NULL,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"adults" smallint NOT NULL,
	"children" smallint DEFAULT 0 NOT NULL,
	"arrival_time" varchar(40) DEFAULT '' NOT NULL,
	"special_requests" text DEFAULT '' NOT NULL,
	"pricing" jsonb NOT NULL,
	"total" integer NOT NULL,
	"promotion_id" uuid,
	"payment_method" varchar(32) DEFAULT 'property' NOT NULL,
	"payment_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"commission_rate_bps" integer NOT NULL,
	"commission_amount" integer NOT NULL,
	"commission_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"status" varchar(32) DEFAULT 'confirmed' NOT NULL,
	"source" varchar(32) DEFAULT 'direct' NOT NULL,
	"hold_expires_at" timestamp with time zone,
	"room_no" varchar(20),
	"notes" text,
	"cancelled_at" timestamp with time zone,
	"cancelled_by" varchar(32),
	"cancellation_reason" text,
	"refund_amount" integer,
	"refund_status" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_ref_unique" UNIQUE("ref"),
	CONSTRAINT "bookings_status_check" CHECK ("bookings"."status" IN ('pending', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled')),
	CONSTRAINT "bookings_source_check" CHECK ("bookings"."source" IN ('direct', 'booking_com', 'expedia', 'travel_agency')),
	CONSTRAINT "bookings_payment_method_check" CHECK ("bookings"."payment_method" IN ('card', 'property')),
	CONSTRAINT "bookings_payment_status_check" CHECK ("bookings"."payment_status" IN ('paid', 'pending')),
	CONSTRAINT "bookings_commission_status_check" CHECK ("bookings"."commission_status" IN ('pending', 'earned', 'void')),
	CONSTRAINT "bookings_cancelled_by_check" CHECK ("bookings"."cancelled_by" IS NULL OR "bookings"."cancelled_by" IN ('guest', 'property', 'admin')),
	CONSTRAINT "bookings_refund_status_check" CHECK ("bookings"."refund_status" IS NULL OR "bookings"."refund_status" IN ('full', 'partial', 'none', 'pending', 'processed')),
	CONSTRAINT "bookings_dates_check" CHECK ("bookings"."check_out" > "bookings"."check_in"),
	CONSTRAINT "bookings_adults_check" CHECK ("bookings"."adults" >= 1),
	CONSTRAINT "bookings_children_check" CHECK ("bookings"."children" >= 0),
	CONSTRAINT "bookings_total_check" CHECK ("bookings"."total" >= 0),
	CONSTRAINT "bookings_commission_check" CHECK ("bookings"."commission_amount" >= 0),
	CONSTRAINT "bookings_cancellation_consistency" CHECK (("bookings"."status" = 'cancelled' AND "bookings"."cancelled_at" IS NOT NULL AND "bookings"."cancelled_by" IS NOT NULL)
          OR ("bookings"."status" <> 'cancelled' AND "bookings"."cancelled_at" IS NULL)),
	CONSTRAINT "bookings_hold_consistency" CHECK (("bookings"."status" = 'pending' AND "bookings"."hold_expires_at" IS NOT NULL)
          OR ("bookings"."status" <> 'pending' AND "bookings"."hold_expires_at" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "idempotency_keys" (
	"key" varchar(128) NOT NULL,
	"user_id" uuid NOT NULL,
	"booking_id" uuid,
	"request_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_user_key_unique" UNIQUE("user_id","key")
);
--> statement-breakpoint
ALTER TABLE "booking_add_ons" ADD CONSTRAINT "booking_add_ons_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_add_ons" ADD CONSTRAINT "booking_add_ons_value_add_id_value_adds_id_fk" FOREIGN KEY ("value_add_id") REFERENCES "public"."value_adds"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_events" ADD CONSTRAINT "booking_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_rate_plan_id_rate_plans_id_fk" FOREIGN KEY ("rate_plan_id") REFERENCES "public"."rate_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_promotion_id_promotions_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_add_ons_booking_idx" ON "booking_add_ons" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "booking_events_booking_idx" ON "booking_events" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_customer_idx" ON "bookings" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "bookings_property_checkin_idx" ON "bookings" USING btree ("property_id","check_in");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bookings_room_dates_idx" ON "bookings" USING btree ("room_id","check_in","check_out");--> statement-breakpoint
CREATE INDEX "idempotency_keys_created_idx" ON "idempotency_keys" USING btree ("created_at");