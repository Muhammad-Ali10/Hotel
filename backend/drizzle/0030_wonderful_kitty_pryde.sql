CREATE TABLE "partner_registrations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'in_progress' NOT NULL,
	"current_step" smallint DEFAULT 5 NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"submitted_at" timestamp with time zone,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"org_id" uuid,
	"property_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_registrations_user_unique" UNIQUE("user_id"),
	CONSTRAINT "partner_registrations_status_check" CHECK ("partner_registrations"."status" IN ('in_progress', 'submitted', 'approved', 'rejected')),
	CONSTRAINT "partner_registrations_step_check" CHECK ("partner_registrations"."current_step" >= 1 AND "partner_registrations"."current_step" <= 31),
	CONSTRAINT "partner_registrations_submitted_check" CHECK (("partner_registrations"."status" = 'in_progress') = ("partner_registrations"."submitted_at" IS NULL)),
	CONSTRAINT "partner_registrations_decided_check" CHECK (("partner_registrations"."status" IN ('approved', 'rejected')) = ("partner_registrations"."decided_at" IS NOT NULL)),
	CONSTRAINT "partner_registrations_result_check" CHECK ("partner_registrations"."status" <> 'approved' OR ("partner_registrations"."org_id" IS NOT NULL AND "partner_registrations"."property_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "registration_documents" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"registration_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"content_type" varchar(100) NOT NULL,
	"storage_key" varchar(512) NOT NULL,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_documents_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "registration_documents_kind_check" CHECK ("registration_documents"."kind" IN ('identity', 'ownership', 'business', 'tax', 'other')),
	CONSTRAINT "registration_documents_status_check" CHECK ("registration_documents"."status" IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "registration_documents_reviewed_check" CHECK (("registration_documents"."status" = 'pending') = ("registration_documents"."reviewed_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "properties" DROP CONSTRAINT "properties_type_check";--> statement-breakpoint
ALTER TABLE "partner_registrations" ADD CONSTRAINT "partner_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_registrations" ADD CONSTRAINT "partner_registrations_org_id_partner_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_registrations" ADD CONSTRAINT "partner_registrations_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_documents" ADD CONSTRAINT "registration_documents_registration_id_partner_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."partner_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_registrations_status_idx" ON "partner_registrations" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "registration_documents_registration_idx" ON "registration_documents" USING btree ("registration_id","kind");--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_type_check" CHECK ("properties"."type" IN (
        'hotel', 'resort', 'guesthouse', 'hostel', 'apartment', 'villa', 'bnb', 'motel'
      ));