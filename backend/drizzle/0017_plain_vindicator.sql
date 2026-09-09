CREATE TABLE "partner_invites" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" varchar(254) NOT NULL,
	"role" varchar(32) DEFAULT 'staff' NOT NULL,
	"property_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"invited_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_invites_token_unique" UNIQUE("token_hash"),
	CONSTRAINT "partner_invites_role_check" CHECK ("partner_invites"."role" IN ('admin', 'manager', 'staff'))
);
--> statement-breakpoint
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_org_id_partner_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "partner_invites_org_idx" ON "partner_invites" USING btree ("org_id","email");