CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"provider" varchar(32) NOT NULL,
	"event_id" varchar(128) NOT NULL,
	"type" varchar(64) NOT NULL,
	"payment_id" uuid,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_events_provider_event_unique" UNIQUE("provider","event_id")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"booking_id" uuid NOT NULL,
	"parent_payment_id" uuid,
	"kind" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'requires_payment_method' NOT NULL,
	"amount" integer NOT NULL,
	"amount_refunded" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_ref" varchar(128),
	"provider_method_ref" varchar(128),
	"card_brand" varchar(24),
	"card_last4" varchar(4),
	"failure_reason" text,
	"captured_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_ref_unique" UNIQUE("provider","provider_ref"),
	CONSTRAINT "payments_kind_check" CHECK ("payments"."kind" IN ('charge', 'guarantee', 'penalty')),
	CONSTRAINT "payments_status_check" CHECK ("payments"."status" IN ('requires_payment_method', 'requires_action', 'authorized',
                          'captured', 'failed', 'cancelled', 'refunded', 'partially_refunded')),
	CONSTRAINT "payments_amount_check" CHECK ("payments"."amount" >= 0),
	CONSTRAINT "payments_refund_check" CHECK ("payments"."amount_refunded" >= 0 AND "payments"."amount_refunded" <= "payments"."amount"),
	CONSTRAINT "payments_kind_amount_check" CHECK (("payments"."kind" = 'guarantee' AND "payments"."amount" = 0)
          OR ("payments"."kind" <> 'guarantee' AND "payments"."amount" > 0)),
	CONSTRAINT "payments_captured_consistency" CHECK (("payments"."status" IN ('captured', 'refunded', 'partially_refunded') AND "payments"."captured_at" IS NOT NULL)
          OR ("payments"."status" NOT IN ('captured', 'refunded', 'partially_refunded') AND "payments"."captured_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "rate_plans" ADD COLUMN "payment_mode" varchar(32) DEFAULT 'prepay' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_mode" varchar(32) DEFAULT 'prepay' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_events_payment_idx" ON "payment_events" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_one_live_primary" ON "payments" USING btree ("booking_id") WHERE kind IN ('charge', 'guarantee') AND status NOT IN ('failed', 'cancelled');--> statement-breakpoint
CREATE INDEX "payments_booking_idx" ON "payments" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_payment_mode_check" CHECK ("rate_plans"."payment_mode" IN ('prepay', 'guarantee'));--> statement-breakpoint
ALTER TABLE "rate_plans" ADD CONSTRAINT "rate_plans_non_refundable_prepay_check" CHECK ("rate_plans"."cancel_free_until" <> 'non_refundable' OR "rate_plans"."payment_mode" = 'prepay');--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_payment_mode_check" CHECK ("bookings"."payment_mode" IN ('prepay', 'guarantee'));