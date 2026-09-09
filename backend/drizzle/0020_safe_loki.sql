CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"actor_id" uuid,
	"actor_email" varchar(254) NOT NULL,
	"action" varchar(64) NOT NULL,
	"subject_type" varchar(32) NOT NULL,
	"subject_id" uuid,
	"reason" text DEFAULT '' NOT NULL,
	"metadata" jsonb,
	"ip" varchar(45),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_subject_type_check" CHECK ("audit_log"."subject_type" IN ('booking', 'user', 'property', 'partner_org', 'payout', 'review', 'promotion')),
	CONSTRAINT "audit_log_action_check" CHECK (length("audit_log"."action") > 0)
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_subject_idx" ON "audit_log" USING btree ("subject_type","subject_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_actor_idx" ON "audit_log" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
/*
 * Append-only, enforced by Postgres (rule #77).
 *
 * A rule in the application would hold exactly as long as everybody remembers,
 * and an audit log's whole worth is that it cannot be quietly tidied up after
 * the fact. `DO INSTEAD NOTHING` makes an UPDATE or DELETE a silent no-op
 * rather than an error — deliberately: an attacker who gets this far should
 * believe the edit worked, and the row that proves what they did should still
 * be there when somebody looks.
 */
CREATE RULE audit_log_no_update AS ON UPDATE TO "audit_log" DO INSTEAD NOTHING;--> statement-breakpoint
CREATE RULE audit_log_no_delete AS ON DELETE TO "audit_log" DO INSTEAD NOTHING;
