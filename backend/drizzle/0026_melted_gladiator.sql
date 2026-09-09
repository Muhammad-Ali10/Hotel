ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_subject_type_check";--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_subject_type_check" CHECK ("audit_log"."subject_type" IN (
        'booking', 'user', 'property', 'partner_org', 'payout', 'review',
        'promotion', 'partner_contract', 'contract_template'
      ));