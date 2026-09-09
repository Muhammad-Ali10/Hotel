ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_subject_type_check";--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_subject_type_check" CHECK ("audit_log"."subject_type" IN (
        'booking', 'user', 'property', 'partner_org', 'payout', 'review',
        'promotion', 'partner_contract', 'contract_template', 'partner_registration',
        -- An announcement sent to customers. Not any of the others: it is
        -- about no single row, which is exactly why it needs recording.
        'notification'
      ));