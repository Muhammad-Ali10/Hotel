CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"property_id" uuid NOT NULL,
	"booking_id" uuid,
	"author_id" uuid,
	"author" varchar(160) NOT NULL,
	"author_seed" varchar(64) DEFAULT '' NOT NULL,
	"country" varchar(80) DEFAULT '' NOT NULL,
	"room_name" varchar(120) DEFAULT '' NOT NULL,
	"rating" smallint NOT NULL,
	"categories" jsonb NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"date" date NOT NULL,
	"status" varchar(32) DEFAULT 'published' NOT NULL,
	"flag_reason" text,
	"response_text" text,
	"response_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_booking_unique" UNIQUE("booking_id"),
	CONSTRAINT "reviews_rating_check" CHECK ("reviews"."rating" >= 1 AND "reviews"."rating" <= 5),
	CONSTRAINT "reviews_status_check" CHECK ("reviews"."status" IN ('published', 'pending', 'flagged', 'rejected')),
	CONSTRAINT "reviews_response_consistency" CHECK (("reviews"."response_text" IS NULL AND "reviews"."response_at" IS NULL)
          OR ("reviews"."response_text" IS NOT NULL AND "reviews"."response_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_property_status_idx" ON "reviews" USING btree ("property_id","status","date");--> statement-breakpoint
CREATE INDEX "reviews_author_idx" ON "reviews" USING btree ("author_id");