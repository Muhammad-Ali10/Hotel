CREATE TABLE "commission_invoice_lines" (
	"invoice_id" uuid NOT NULL,
	"booking_id" uuid NOT NULL,
	"booking_ref" varchar(16) NOT NULL,
	"total" integer NOT NULL,
	"commission" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_invoice_lines_invoice_id_booking_id_pk" PRIMARY KEY("invoice_id","booking_id"),
	CONSTRAINT "commission_invoice_lines_booking_unique" UNIQUE("booking_id")
);
--> statement-breakpoint
CREATE TABLE "commission_invoices" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"ref" varchar(32) NOT NULL,
	"partner_org_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"gross_amount" integer NOT NULL,
	"amount" integer NOT NULL,
	"booking_count" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"status" varchar(32) DEFAULT 'issued' NOT NULL,
	"due_date" date NOT NULL,
	"paid_at" timestamp with time zone,
	"payment_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_invoices_ref_unique" UNIQUE("ref"),
	CONSTRAINT "commission_invoices_period_unique" UNIQUE("partner_org_id","period_start"),
	CONSTRAINT "commission_invoices_status_check" CHECK ("commission_invoices"."status" IN ('issued', 'paid', 'overdue', 'void')),
	CONSTRAINT "commission_invoices_amount_check" CHECK ("commission_invoices"."amount" >= 0 AND "commission_invoices"."gross_amount" >= 0),
	CONSTRAINT "commission_invoices_period_check" CHECK ("commission_invoices"."period_end" >= "commission_invoices"."period_start"),
	CONSTRAINT "commission_invoices_paid_consistency" CHECK (("commission_invoices"."status" = 'paid') = ("commission_invoices"."paid_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "partner_orgs" ADD COLUMN "settlement_mode" varchar(32) DEFAULT 'deduct' NOT NULL;--> statement-breakpoint
ALTER TABLE "partner_orgs" ADD COLUMN "payouts_held" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "commission_invoice_lines" ADD CONSTRAINT "commission_invoice_lines_invoice_id_commission_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."commission_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_invoice_lines" ADD CONSTRAINT "commission_invoice_lines_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_invoices" ADD CONSTRAINT "commission_invoices_partner_org_id_partner_orgs_id_fk" FOREIGN KEY ("partner_org_id") REFERENCES "public"."partner_orgs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commission_invoice_lines_invoice_idx" ON "commission_invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "commission_invoices_org_idx" ON "commission_invoices" USING btree ("partner_org_id","period_start");--> statement-breakpoint
CREATE INDEX "commission_invoices_due_idx" ON "commission_invoices" USING btree ("status","due_date");--> statement-breakpoint
ALTER TABLE "partner_orgs" ADD CONSTRAINT "partner_orgs_settlement_mode_check" CHECK ("partner_orgs"."settlement_mode" IN ('deduct', 'invoice'));