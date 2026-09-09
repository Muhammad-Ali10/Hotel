CREATE TABLE "contract_templates" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"kind" varchar(32) NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"effective_from" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_templates_kind_version_unique" UNIQUE("kind","version"),
	CONSTRAINT "contract_templates_kind_check" CHECK ("contract_templates"."kind" IN ('service', 'commission', 'addendum', 'policy')),
	CONSTRAINT "contract_templates_version_check" CHECK ("contract_templates"."version" >= 1),
	CONSTRAINT "contract_templates_body_check" CHECK (length(trim("contract_templates"."body")) > 0)
);
--> statement-breakpoint
CREATE TABLE "partner_contracts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"org_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"kind" varchar(32) NOT NULL,
	"version" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"status" varchar(32) DEFAULT 'accepted' NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"accepted_by_user_id" uuid,
	"accepted_by_name" varchar(160) NOT NULL,
	"accepted_ip" varchar(64),
	"expires_at" date,
	"ended_at" timestamp with time zone,
	"ended_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_contracts_org_template_unique" UNIQUE("org_id","template_id"),
	CONSTRAINT "partner_contracts_kind_check" CHECK ("partner_contracts"."kind" IN ('service', 'commission', 'addendum', 'policy')),
	CONSTRAINT "partner_contracts_status_check" CHECK ("partner_contracts"."status" IN ('accepted', 'superseded', 'terminated')),
	CONSTRAINT "partner_contracts_ended_check" CHECK (("partner_contracts"."status" = 'accepted') = ("partner_contracts"."ended_at" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "partner_contracts" ADD CONSTRAINT "partner_contracts_org_id_partner_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contracts" ADD CONSTRAINT "partner_contracts_template_id_contract_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."contract_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_contracts" ADD CONSTRAINT "partner_contracts_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contract_templates_active_idx" ON "contract_templates" USING btree ("kind","active");--> statement-breakpoint
CREATE INDEX "partner_contracts_org_idx" ON "partner_contracts" USING btree ("org_id","accepted_at");--> statement-breakpoint
-- A signature is a record of a moment, so the database refuses to let one be
-- rewritten. The lifecycle columns (status, ended_at, ended_reason, updated_at)
-- stay editable: an agreement can be superseded or terminated, and recording
-- that is not the same as changing what somebody signed.
--
-- A trigger rather than a RULE, because this has to be conditional. The audit
-- log can use `DO INSTEAD NOTHING` because NOTHING there is ever editable.
CREATE OR REPLACE FUNCTION partner_contracts_signature_is_final()
RETURNS trigger AS $$
BEGIN
  IF NEW.org_id             IS DISTINCT FROM OLD.org_id
  OR NEW.template_id        IS DISTINCT FROM OLD.template_id
  OR NEW.kind               IS DISTINCT FROM OLD.kind
  OR NEW.version            IS DISTINCT FROM OLD.version
  OR NEW.title              IS DISTINCT FROM OLD.title
  OR NEW.body               IS DISTINCT FROM OLD.body
  OR NEW.accepted_at        IS DISTINCT FROM OLD.accepted_at
  OR NEW.accepted_by_user_id IS DISTINCT FROM OLD.accepted_by_user_id
  OR NEW.accepted_by_name   IS DISTINCT FROM OLD.accepted_by_name
  OR NEW.accepted_ip        IS DISTINCT FROM OLD.accepted_ip
  THEN
    RAISE EXCEPTION 'A signed agreement cannot be altered (partner_contracts.%)', NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER partner_contracts_signature_guard
BEFORE UPDATE ON "partner_contracts"
FOR EACH ROW EXECUTE FUNCTION partner_contracts_signature_is_final();
