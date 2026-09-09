CREATE TABLE "booking_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"booking_id" uuid NOT NULL,
	"author_side" varchar(32) NOT NULL,
	"author_id" uuid,
	"author_name" varchar(160) DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "booking_messages_side_check" CHECK ("booking_messages"."author_side" IN ('guest', 'property')),
	CONSTRAINT "booking_messages_body_check" CHECK (length(trim("booking_messages"."body")) > 0)
);
--> statement-breakpoint
CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_kind" varchar(32) NOT NULL,
	"author_id" uuid,
	"author_name" varchar(160) DEFAULT '' NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_messages_author_kind_check" CHECK ("support_messages"."author_kind" IN ('requester', 'agent', 'internal')),
	CONSTRAINT "support_messages_body_check" CHECK (length(trim("support_messages"."body")) > 0)
);
--> statement-breakpoint
CREATE TABLE "support_threads" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"ref" varchar(16) NOT NULL,
	"audience" varchar(32) NOT NULL,
	"requester_id" uuid,
	"requester_email" varchar(254) NOT NULL,
	"requester_name" varchar(160) DEFAULT '' NOT NULL,
	"org_id" uuid,
	"booking_id" uuid,
	"subject" varchar(200) NOT NULL,
	"category" varchar(64) DEFAULT 'general' NOT NULL,
	"priority" varchar(32) DEFAULT 'medium' NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"assignee_id" uuid,
	"resolved_at" timestamp with time zone,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_threads_audience_check" CHECK ("support_threads"."audience" IN ('guest', 'partner')),
	CONSTRAINT "support_threads_status_check" CHECK ("support_threads"."status" IN ('open', 'in_progress', 'resolved')),
	CONSTRAINT "support_threads_priority_check" CHECK ("support_threads"."priority" IN ('low', 'medium', 'high')),
	CONSTRAINT "support_threads_org_matches_audience" CHECK (("support_threads"."audience" = 'partner') = ("support_threads"."org_id" IS NOT NULL)),
	CONSTRAINT "support_threads_anonymous_has_no_booking" CHECK ("support_threads"."requester_id" IS NOT NULL OR "support_threads"."booking_id" IS NULL),
	CONSTRAINT "support_threads_resolved_consistency" CHECK (("support_threads"."status" = 'resolved') = ("support_threads"."resolved_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "booking_messages" ADD CONSTRAINT "booking_messages_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_messages" ADD CONSTRAINT "booking_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_thread_id_support_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."support_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_org_id_partner_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_assignee_id_users_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "booking_messages_booking_idx" ON "booking_messages" USING btree ("booking_id","created_at");--> statement-breakpoint
CREATE INDEX "support_messages_thread_idx" ON "support_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "support_threads_ref_idx" ON "support_threads" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "support_threads_queue_idx" ON "support_threads" USING btree ("status","last_message_at");--> statement-breakpoint
CREATE INDEX "support_threads_requester_idx" ON "support_threads" USING btree ("requester_id","created_at");--> statement-breakpoint
CREATE INDEX "support_threads_org_idx" ON "support_threads" USING btree ("org_id","created_at");--> statement-breakpoint
CREATE INDEX "support_threads_email_idx" ON "support_threads" USING btree ("requester_email");