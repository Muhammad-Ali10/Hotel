CREATE TABLE "partner_members" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'staff' NOT NULL,
	"status" varchar(32) DEFAULT 'invited' NOT NULL,
	"property_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_members_org_user_unique" UNIQUE("org_id","user_id"),
	CONSTRAINT "partner_members_role_check" CHECK ("partner_members"."role" IN ('admin', 'manager', 'staff')),
	CONSTRAINT "partner_members_status_check" CHECK ("partner_members"."status" IN ('active', 'invited', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE "partner_orgs" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" varchar(160) NOT NULL,
	"status" varchar(32) DEFAULT 'trial' NOT NULL,
	"plan_tier" varchar(32) DEFAULT 'starter' NOT NULL,
	"commission_rate_bps" integer DEFAULT 1500 NOT NULL,
	"contact_email" varchar(254) DEFAULT '' NOT NULL,
	"contact_phone" varchar(32) DEFAULT '' NOT NULL,
	"country" varchar(80) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_orgs_status_check" CHECK ("partner_orgs"."status" IN ('active', 'trial', 'past_due', 'suspended')),
	CONSTRAINT "partner_orgs_plan_tier_check" CHECK ("partner_orgs"."plan_tier" IN ('starter', 'professional', 'enterprise')),
	CONSTRAINT "partner_orgs_commission_check" CHECK ("partner_orgs"."commission_rate_bps" >= 0 AND "partner_orgs"."commission_rate_bps" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"absolute_expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_agent" varchar(256) DEFAULT '' NOT NULL,
	"ip" varchar(64) DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_credentials" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"email" varchar(254) NOT NULL,
	"role" varchar(32) DEFAULT 'customer' NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"first_name" varchar(80) NOT NULL,
	"last_name" varchar(80) NOT NULL,
	"phone" varchar(32) DEFAULT '' NOT NULL,
	"country" varchar(80) DEFAULT '' NOT NULL,
	"city" varchar(80) DEFAULT '' NOT NULL,
	"avatar_seed" varchar(64) DEFAULT '' NOT NULL,
	"tier" varchar(32) DEFAULT 'standard' NOT NULL,
	"membership" varchar(40) DEFAULT '' NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"preferences" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"email_verified_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('customer', 'partner', 'admin')),
	CONSTRAINT "users_status_check" CHECK ("users"."status" IN ('active', 'suspended', 'blocked')),
	CONSTRAINT "users_tier_check" CHECK ("users"."tier" IN ('standard', 'genius')),
	CONSTRAINT "users_points_check" CHECK ("users"."points" >= 0)
);
--> statement-breakpoint
ALTER TABLE "partner_members" ADD CONSTRAINT "partner_members_org_id_partner_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_members" ADD CONSTRAINT "partner_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_credentials" ADD CONSTRAINT "user_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_members_user_id_idx" ON "partner_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");